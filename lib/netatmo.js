var moment = require('moment');
var OAuth2 = require("oauth").OAuth2;
var path = require('path');
var request = require("request");

var device = null;
var moduleItem = null;
var netatmoUserMail = "";

var netatmo = function(config) {

    var accessToken = null;
    var refreshToken = null;

    function getDeviceList (callback) {
        console.log("fetching device list");

        var cb = typeof callback == 'function' ? callback : function(){};

        request.get({ url : "http://api.netatmo.net/api/devicelist?access_token=" + accessToken, json:true}, function(err, response, data) {

            if (err) {
                cb(err);
                return;
            }

            if (invalidToken(data)){

                handleInvalidAccessToken(function(err, newAccessToken, newRefreshToken){

                    if (err){
                        // failed to get a new refreshtoken
                        cb(err);
                    } else {
                        console.log("retrying getDeviceList in 10s...")
                        setTimeout(function(){
                            getDeviceList(cb);
                        }, 1000 * 10);
                    }

                });

                return;
            }

            // everything ok
            cb(false, data);
        });

    }

    function invalidToken(data){
        if (data.error && (data.error.code == 2 || data.error.code == 3)){
            return true;
        }

        return false;
    }

    function handleInvalidAccessToken(callback){

        var cb = typeof callback == 'function' ? callback : function(){};

        console.log("refreshing access token");

        refreshAccessToken(function(err, newAccessToken) {
            if (err){
                console.log("refresh failed");
                console.log(err);
                // we allow fallthrough here, the refreshtoken may be invalid too
            }

            if (newAccessToken) {
                accessToken = newAccessToken;
                console.log("access token refreshed");
                cb(false, accessToken, refreshToken);
            } else {
                // if we couldn't get an access token get a new one
                console.log("trying to get new access token");
                getNewAccessToken(function(err, newAccessToken, newRefreshToken){

                    if (err){
                        // refreshing and getting a new token failed, pass the error in the cb
                        console.log("failed getting new access token");
                        cb(err);
                        return;
                    }

                    accessToken = newAccessToken;
                    refreshToken = newRefreshToken;
                    console.log("got new access token");

                    cb(false, accessToken, refreshToken);
                });
            }
        });
    }

    function getDeviceData(deviceid, cb){

        var startDate = moment().subtract('days', 7);
        var endDate = moment().add('days', 7);
        var dates = "&date_begin=" + startDate.format("YYYY-MM-DD") + "&date_end=" + endDate.format("YYYY-MM-DD");

        var url = "http://api.netatmo.net/api/getmeasure?access_token=" + accessToken + dates + "&device_id=" + deviceid + "&scale=30min&type=Temperature,CO2,Humidity,Pressure,Noise&optimize=false";

        request.get({url : url, json:true}, function(err, response, data){

            if(err){
                cb(err);
                return;
            }

            if(invalidToken(data)){
                // just handle the invalid token and let the next interval tick get the data
                handleInvalidAccessToken();
            } else {
                cb(false, data);
            }

        });

    }

    function getModuleData(deviceid, moduleid, cb){

        var startDate = moment().subtract('days', 7);
        var endDate = moment().add('days', 7);
        var dates = "&date_begin=" + startDate.format("YYYY-MM-DD") + "&date_end=" + endDate.format("YYYY-MM-DD");
        var url = "http://api.netatmo.net/api/getmeasure?access_token=" + accessToken + dates +  "&module_id=" + moduleid + "&device_id=" + deviceid + "&scale=30min&type=Temperature,CO2,Humidity,Pressure,Noise&optimize=false";

        request.get({url : url, json:true}, function(err, response, data){

            if(err){
                cb(err);
                return;
            }

            if(invalidToken(data)){
                // just handle the invalid token and let the next interval tick get the data
                handleInvalidAccessToken();
            } else {
                cb(false, data);
            }

        });

    }

    function refreshAccessToken(callback) {

        if (!refreshToken){
            callback("empty refreshToken");
            return;
        }

        this._clientId = config.clientId;
        this._clientSecret = config.clientSecret;
        this._basePath = '';
        this._authorizePath = 'https://api.netatmo.net/oauth2/authorize';
        this._accessTokenPath = 'https://api.netatmo.net/oauth2/token';

        var oa = new OAuth2(this._clientId, this._clientSecret, this._basePath, this._authorizePath, this._accessTokenPath);

        var data = { grant_type: "refresh_token" };
        oa.getOAuthAccessToken(
            refreshToken,
            data,
            function (error, access_token, refresh_token) {
                if (error) {
                    return callback(error);
                }

                console.log(arguments);
                return callback(null, access_token);
            }
        );

    }

    function getNewAccessToken(callback) {

        this._clientId = config.clientId;
        this._clientSecret = config.clientSecret;
        this._basePath = '';
        this._authorizePath = 'https://api.netatmo.net/oauth2/authorize';
        this._accessTokenPath = 'https://api.netatmo.net/oauth2/token';

        var oa = new OAuth2(this._clientId, this._clientSecret, this._basePath, this._authorizePath, this._accessTokenPath);

        var data = {
            password : config.password,
            username : config.username,
            grant_type: "password",
            scope : ""
        };

        oa.getOAuthAccessToken(
            '',
            data,
            function (error, access_token, refresh_token) {
                if (error) {
                    return callback(error);
                }

                return callback(null, access_token, refresh_token);
            }
        );
    }


    return {
        getDeviceList : getDeviceList,
        getDeviceData : getDeviceData,
        getModuleData : getModuleData,
        getNewAccessToken : getNewAccessToken,
        refreshAccessToken : refreshAccessToken
    };

};

module.exports = netatmo;
