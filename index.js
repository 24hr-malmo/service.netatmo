var helper = require("service.helper");
var zonar = require("zonar");
var zmq = require("zmq");
var config = require("./config");
var netatmo = require("./lib/netatmo")(config);

var device = null;
var module = null;
netatmo.getDeviceList(function(err, data){
    if (err){
        console.log("FATAL:");
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
                    pubsock.send(JSON.stringify(list));
                }
            });
        });
    };

    setInterval(function(){
        getData();
    }, 1000 * 60 * 5);
    getData();
});

var doc = helper.createDoc({ filename : "README.md"});
var pubsockPort = config.servicePort;
var z = zonar.create({
    net : "24hr",
    name : "netatmo",
    payload : {
        doc : doc.getPayload(),
        reading : {
            type : "pub",
            port : config.servicePort
        }
    }
});

var pubsock = zmq.socket("pub");

pubsock.bindSync("tcp://*:" + config.servicePort);

z.start(function(){
    console.log("started");
});

helper.handleInterrupt(z);
