var fs = require('fs');
var request = require('request');

/**
 *  Put your settings here:
 *      - filename: file to which the payments for the mass payment tool are written
 *      - node: address of your node in the form http://<ip>:<port>
 *      - apiKey: the API key of the node that is used for distribution
 *      - feeAssetId: id of the asset used to pay the fee, null for Waves
 *      - fee: amount of fee to spend for the tx
 */
var config = {
    filename: 'payments.json', // put the file name where payments have been written.
    node: 'http://localhost:6861', // put the IP address of your REST API node
    apiKey: '', // put your secret API Key
    feeAssetId: null, // TN token
    feeAssetId2: "", //assetId of node's token
    fee: 2000000, // put 2000000 (0.02 TN)
    x: 0 // if 0 - check transactions, 1 - do trans. DO FIRST RUN WITH 0 TO CHECK THE TRANSACTIONS
};
/**
 * The method that starts the payment process.
 */
var transfers = [];
var transfers2 = [];
var counter = 0;
var counter2 = 0;
var total = 0;
var total2 = 0;
var asset = [];

var start = function () {
    var paymentsString = fs.readFileSync(config.filename).toString();
    var payments = JSON.parse(paymentsString);
    preparePayment(payments);
    if (config.x == 1) {
        if (counter > 0) {
            doPayment(payments, config.timestamp, transfers, config.feeAssetId, counter);
        }
        if (counter2 > 0) {
            doPayment(payments, config.timestamp, transfers2, config.feeAssetId2, counter2);
        }
    }
}

var preparePayment = function(payments) {
    for (var i = 0; i < payments.length; i++) {
        if (!("assetId" in payments[i])) {
            transfers.push({"recipient": payments[i].recipient, "amount": payments[i].amount});
            //console.log("recipient: " + payments[i].recipient + " amount: " + payments[i].amount + " TN ");
            total = total + payments[i].amount;
            counter++;
        }
        else if (payments[i].assetId == config.feeAssetId2) {
            transfers2.push({ "recipient": payments[i].recipient, "amount": payments[i].amount });
            //console.log("recipient: " + payments[i].recipient + " amount: " + payments[i].amount + " BTN ");
            total2 = total2 + payments[i].amount;
            counter2++;
        }
    }
    AssetName(function () {
        name = asset.name;
        if (config.x == 0) {
        var totalT = total / Math.pow(10, 8);
            var totalT2 = total2 / Math.pow(10, asset.decimals);
            if (counter > 0) {
                console.log('totalpay of TN = ' + totalT + " to " + counter + " addresses");
            }
            else { console.log('No payments of TN')}
            if (counter2 > 0) {
                console.log('totalpay of ' + asset.name + " " + totalT2 + " to " + counter2 + " addresses");
            }
            else { console.log('No payments of ' + asset.name) }
            console.log("fees = " + (((config.fee + 1000000 * counter) + (config.fee + 1000000 * counter)) / Math.pow(10, 8)) + " TN");
        }
    });
}

var doPayment = function (payments, timestamp, trans, assId, count) {
    var payment = payments[0];
    var txFee = config.fee + 1000000 * (count + 1);
    var data = {
        "version": 1,
        "assetId": assId,
        "sender": payment.sender,
        "transfers": trans,
        "fee": txFee,
        "timestamp": Date.now(),
        "attachment": '59QuUcqP6p',
    };
    //console.log(data);
    setTimeout(function () {
        request.post({ url: config.node + '/assets/masstransfer', json: data, headers: { "Accept": "application/json", "Content-Type": "application/json", "api_key": config.apiKey } }, function (err, response, body) {
            if (err) {
                console.log(err);
            } else {
                if (body.error) {
                    console.log('error during transfer: ' + body.message);
                } else {
                    //console.log(body)
                    console.log('Payment pass')
                }
            }
        });
    }, 1000);
}

function AssetName(cb) {
    request.get(config.node + '/transactions/info/' + config.feeAssetId2, function (err, response, body) {
        if (!err) {
            asset = JSON.parse(body);
            cb();
        }
    });
}
start();
