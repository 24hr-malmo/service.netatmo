var helper = require("service.helper");
var config = require("./config");
var netatmo = require("./lib/netatmo")(config);

var device = null;
var module = null;
var latestData = "no data :/";

netatmo.getDeviceList(function(err, data){
    if (err){
        console.log("FATAL:");
        console.log(data);
        console.log(err);
        process.exit();
    }

    device = data.body.devices[0];
    module = data.body.modules[0];

    var getData = function(){
        console.log(new Date() + " fetching data");
        netatmo.getDeviceData(device._id, function(err, data){
            var list = [];
            var ref = {};

            if (err){
                console.log(err);
            } else {

                for(var timestamp in data.body) {
                    var entry = {
                        timestamp: timestamp,
                        values: {
                            temperature: data.body[timestamp][0],
                            co2: data.body[timestamp][1],
                            humidity: data.body[timestamp][2],
                            pressure: data.body[timestamp][3],
                            noise: data.body[timestamp][4]
                        }
                    };
                    ref[timestamp] = entry;
                    list.push(entry);
                }
            }

            netatmo.getModuleData(device._id, module._id, function(err, data){
                if (err){
                    console.log(err);
                } else {
                    for(var timestamp in data.body) {
                        if (ref[timestamp]) {
                            ref[timestamp].values.outdoorTemperature = data.body[timestamp][0];
                        }
                    }
                    latestData = JSON.stringify(list);
                    publish(latestData);
                }
            });
        });
    };

    setInterval(function(){
        getData();
    }, 1000 * 60 * 5);
    getData();
});


var s = helper.service();

var publish;

s.pub({endpointName : "pub"}, function(err, publisher){
    if(err){
        console.log("FATAL: could not fetch publisher");
        console.log(err);
        process.exit();
    }
    publish = publisher;
});

s.rep({endpointName : "latest"}, function(err, msg, reply){
    if(err){
        console.log("ERROR: when trying to reply");
        console.log(err);
        return;
    }

    console.log("Sending latest");
    console.log(latestData);
    reply(latestData);
});

s.doc({filename : "README.md"});

s.broadcast({ net : "24hr", name : "netatmo", broadcastAddress : "172.16.135.255" }, function(){
    s.handleInterrupt();
    console.log("started");
});

