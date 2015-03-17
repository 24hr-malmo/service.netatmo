var helper = require("service.helper");
var config = require("./config");
var netatmo = require("./lib/netatmo")(config);

netatmo.getNewAccessToken(function(){

    console.log(JSON.stringify(arguments));

})

