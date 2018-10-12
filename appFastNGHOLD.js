var request = require('sync-request');
var LineReaderSync = require("line-reader-sync")
var syncRequest = require('sync-request');
var fs = require('fs');

/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - alias: the alias of the node address
 *     - startBlockHeight: the block from which you want to start distribution for
 *     - endBlock: the block until you want to distribute the earnings
 *     - distributableBTNPerBlock: amount of node's token distributed per forged block
 *     - decimalsoftoken: decimals of node's token
 *     - filename: file to which the payments for the mass payment tool are written
 *     - node: address of your node in the form http://<ip>:<port
 *     - percentageOfFeesToDistribute: the percentage of fees that you want to distribute
 *     - blockStorage: file for storing block history
 *     - assetId: id of node's token
 *     - excludeList: List, who will not get bonus for hold token, for ex. issuer, exchanges.
 *     - percentageOfFeesToDistributeHOLDers: Percentage of earned fees to distribute to holders of node's token.
 *     - minAmounttoPayTN: TN min amount to pay
 *     - minHold: min hold to get for holding
 *     - MinIfNotLease: min getting amount if not leasing, but holding node's token, where 2000000 = 0.02 TN
 *     - MinIfLeaseAndHold:  min amount if leasing and holding 
 *     - minBTNpays: Min amount of node's token
 */
var config = {
address: '', 
alias: 'Your node alias',
startBlockHeight: 1,
endBlock: 76720, // put here the block height you want to calculate the payment distribution
distributableBTNPerBlock: 10,
decimalsoftoken: 3, // put here decimals of node's token
filename: 'payments.json', // put here the file name where the payments needs to be written
node: 'http://localhost:6861', // put here the address of REST API
percentageOfFeesToDistribute: 80, // put here the percentage of fees you want to distribute to leasers
blockStorage: 'blocks.json',
assetId: '', // put here assetId of node's token
excludeList: [''], // put here address, which won't get fee for holding node's token
percentageOfFeesToDistributeHOLDers: 10, // put here how much distribute to holders. Can be 0, if you don't have holders or don't want to distribute to them.
minAmounttoPayTN: 0, // put here TN min amount to pay, where 2000000 = 0.02 TN
minHold: 1000, //min hold to get for holding
MinIfNotLease: 2000000, //min getting amount if not leasing, but holding node's token, where 2000000 = 0.02 TN
MinIfLeaseAndHold: 0, // min amount if leasing and holding 
minBTNpays: 1 //Min amount of node's token
};


var payments = [];
var BTN = [];
var myLeases = {};
var myCanceledLeases = {};
var myForgedBlocks = [];
var total2 = 0;
var payments2 = [];
var totalDistributed2 = 0;
var totalfee = 0;
var transactionsG = [];


/**
 * This method starts the overall process by first downloading the blocks,
 * preparing the necessary datastructures and finally preparing the payments
 * and serializing them into a file that could be used as input for the
 * masspayment tool.
 */
var start = function() {
    console.log('getting blocks...');
    var blocks = getAllBlocks();
    if (fs.existsSync(config.blockStorage)) {
        fs.unlinkSync(config.blockStorage);
    }
    console.log('preparing datastructures...');
    prepareDataStructure(blocks);
    blocks.forEach(function(block) {
        var transactions = [];

        if (block.height < config.startBlockHeight) {
            block.transactions.forEach(function(tx) {
                if (tx.type === 8 || tx.type === 9) {
                    transactions.push(tx);
                }
            });
        } else {
            transactions = block.transactions;
        }

        var blockInfo = {
            height: block.height,
            generator: block.generator,
            wavesFees: block.wavesFees,
            previousBlockWavesFees: block.previousBlockWavesFees,
            transactions: transactions
        };
        fs.appendFileSync(config.blockStorage, JSON.stringify(blockInfo) + '\n');
    });
    console.log('preparing payments...');
    myForgedBlocks.forEach(function(block) {
        if (block.height >= config.startBlockHeight && block.height <= config.endBlock) {
            var blockLeaseData = getActiveLeasesAtBlock(block);
            var activeLeasesForBlock = blockLeaseData.activeLeases;
            var amountTotalLeased = blockLeaseData.totalLeased;

            distribute(activeLeasesForBlock, amountTotalLeased, block);
        }
    });
var richlist;

    if (config.assetId && config.assetId.length > 0) {
        richlist= JSON.parse(syncRequest('GET', config.node + '/assets/' + config.assetId + '/distribution', {
            'headers': {
                'Connection': 'keep-alive'
            }
        }).getBody());
    } else {
        richlist= JSON.parse(syncRequest('GET', config.node + '/debug/stateTN/' + config.endBlock, {
            'headers': {
                'Connection': 'keep-alive'
            }
        }).getBody());
    }

    config.excludeList.forEach(function(excludeAddress) {
        richlist[excludeAddress] = 0;
    });
    total = checkTotalDistributableAmount(richlist);
    pay(richlist);
    startDistribute(richlist);
};

/**
 * This method organizes the datastructures that are later on necessary
 * for the block-exact analysis of the leases.
 *
 *   @param blocks all blocks that should be considered
 */
var prepareDataStructure = function(blocks) {
    var previousBlock;
    blocks.forEach(function(block) {
        var wavesFees = 0;

        if (block.generator === config.address) {
            myForgedBlocks.push(block);
        }

        block.transactions.forEach(function(transaction) {
            // type 8 are leasing tx
            if (transaction.type === 8 && (transaction.recipient === config.address || transaction.recipient === "address:" + config.address || transaction.recipient === 'alias:L:' + config.alias)) {
                transaction.block = block.height;
                myLeases[transaction.id] = transaction;
            } else if (transaction.type === 9 && myLeases[transaction.leaseId]) { // checking for lease cancel tx
                transaction.block = block.height;
                myCanceledLeases[transaction.leaseId] = transaction;
            }
            // considering Waves fees
            if (!transaction.feeAsset || transaction.feeAsset === '' || transaction.feeAsset === null) {
                if (transaction.fee < 1001 * Math.pow(10, 8)) {
                    wavesFees += transaction.fee;
                }
            }
        });
        if (previousBlock) {
            block.previousBlockWavesFees = previousBlock.wavesFees;
        }
        block.wavesFees = wavesFees;
        previousBlock = block;
    });
};

/**
 * Method that returns all relevant blocks.
 *
 * @returns {Array} all relevant blocks
 */
var getAllBlocks = function() {
    // leases have been resetted in block 462000, therefore, this is the first relevant block to be considered
    var firstBlockWithLeases = 1;
    var currentStartBlock = firstBlockWithLeases;
    var blocks = [];
    var steps = 100;

    if (fs.existsSync(config.blockStorage)) {
        lrs = new LineReaderSync(config.blockStorage);

        var lineFound = true;
        while(lineFound){
            var line = lrs.readline()
            if(line){
                blocks.push(JSON.parse(line));
            } else {
                lineFound = false;
            }
        }

        currentStartBlock = blocks[blocks.length - 1].height + 1;
        console.log('retrieved blocks from ' + blocks[0].height + ' to ' + (currentStartBlock - 1));
    }

    while (currentStartBlock < config.endBlock) {
        var currentBlocks;

        if (currentStartBlock + (steps - 1) < config.endBlock) {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + (currentStartBlock + (steps - 1)));
            var res = request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + (currentStartBlock + (steps - 1)), {
                'headers': {
                    'Connection': 'keep-alive'
                }
            });
            if (res.body) {
                var blocksJSON = res.body.toString();
                currentBlocks = JSON.parse(blocksJSON);
            } else {
                currentBlocks = [];
            }
        } else {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + config.endBlock);
            currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + config.endBlock, {
                'headers': {
                    'Connection': 'keep-alive'
                }
            }).getBody('utf8'));
        }
        if (currentBlocks.length > 0) {
            currentBlocks.forEach(function(block) {
                if (block.height <= config.endBlock) {
                    blocks.push(block);
                }
            });

            if (currentStartBlock + steps < config.endBlock) {
                currentStartBlock += steps;
            } else {
                currentStartBlock = config.endBlock;
            }
        }
    }

    return blocks;
};

/**
 * This method distributes either Waves fees and MRT to the active leasers for
 * the given block.
 *
 * @param activeLeases active leases for the block in question
 * @param amountTotalLeased total amount of leased waves in this particular block
 * @param block the block to consider
 */
var distribute = function(activeLeases, amountTotalLeased, block, previousBlock) {
    var fee;

    if (block.height >= 8000) {
        fee = block.wavesFees * 0.4 + block.previousBlockWavesFees * 0.6;
    } else {
        fee = block.wavesFees
    }
    totalfee = totalfee + fee;
    for (var address in activeLeases) {
        var share = (activeLeases[address] / amountTotalLeased)
        var amount = fee * share;
        var amountBTN = share * config.distributableBTNPerBlock;

        if (payments[address]) {
            payments[address] += amount * (config.percentageOfFeesToDistribute / 100);
            BTN[address] += amountBTN;
        } else {
            payments[address] = amount * (config.percentageOfFeesToDistribute / 100);
            BTN[address] = amountBTN;
        }
    }
};

/**
 * Method that creates the concrete payment tx and writes it to the file
 * configured in the config section.
 */
var pay = function(richlist) {
    for (var address in payments) {
        var payment = (payments[address] / Math.pow(10, 8));

        if (Number(Math.round(payments[address])) > config.minAmounttoPayTN && !(richlist[address] > config.minHold)) {
            transactionsG.push({
                "amount": Number(Math.round(payments[address])),
                "fee": 2000000,
                "sender": config.address,
                "attachment": "", // must be encoded with base58
                "recipient": address
            });
        }
        if (Number(Math.round(BTN[address] * Math.pow(10, config.decimalsoftoken))) > Number((config.minBTNpays*Math.pow(10,config.decimalsoftoken)))) {
            transactionsG.push({
                "amount": Number(Math.round(BTN[address] * Math.pow(10, config.decimalsoftoken))),
                "fee": 2000000,
                "assetId": config.assetId,
                "sender": config.address,
                "attachment": "", // must be encoded with base58
                "recipient": address
            });
        }
    }
    fs.writeFile(config.filename, JSON.stringify(transactionsG), {}, function(err) {
        if (!err) {
            console.log('payments written to ' + config.filename + '!');
        } else {
            console.log(err);
        }
    });
};

/**
 * This method returns (block-exact) the active leases and the total amount
 * of leased Waves for a given block.
 *
 * @param block the block to consider
 * @returns {{totalLeased: number, activeLeases: {}}} total amount of leased waves and active leases for the given block
 */
var getActiveLeasesAtBlock = function(block) {
    var activeLeases = [];
    var totalLeased = 0;
    var activeLeasesPerAddress = {};

    for (var leaseId in myLeases) {
        var currentLease = myLeases[leaseId];

        if (!myCanceledLeases[leaseId] || myCanceledLeases[leaseId].block > block.height) {
            activeLeases.push(currentLease);
        }
    }
    activeLeases.forEach(function (lease) {
        if (block.height > lease.block + 1000) {
            if (!activeLeasesPerAddress[lease.sender]) {
                activeLeasesPerAddress[lease.sender] = lease.amount;
            } else {
                activeLeasesPerAddress[lease.sender] += lease.amount;
            }

            totalLeased += lease.amount;
        }
    });

    return { totalLeased: totalLeased, activeLeases: activeLeasesPerAddress };
};





var checkTotalDistributableAmount = function(richlist) {
    var total2 = 0;
    for (var address in richlist) {
        var amount = richlist[address];

        total2 += amount;
    }

    return total2;
};


var startDistribute = function(richlist, block) {
    var transactions = [];
    for (var address in richlist) {
        if (richlist[address] > config.minHold){
        var amount = richlist[address];
        var percentage = amount / total;
        var amount2 = totalfee * percentage;
        var amountToSend = amount2 * ((config.percentageOfFeesToDistributeHOLDers) / 100);


        transactions.push({ address: address, amount: amountToSend });
        }
    }

    sendToRecipients(transactions, 0);
};


var sendToRecipients = function(txList, index) {
    if (Number(Math.round(payments[txList[index].address])) > 0) {
        var payment = {
            "amount": Math.round(txList[index].amount) + Number(Math.round(payments[txList[index].address])),
            "fee": 2000000,
            "sender": config.address,
            "attachment": "",
            "recipient": txList[index].address
        };
    }
    else {
        var payment = {
            "amount": Math.round(txList[index].amount),
            "fee": 2000000,
            "sender": config.address,
            "attachment": "",
            "recipient": txList[index].address
        };
    }
    if (Math.round(txList[index].amount) > config.MinIfNotLease || (Number(Math.round(payments[txList[index].address])) > config.MinIfLeaseAndHold)) {
        payments2.push(payment);
    }
    index++;
    if (index < txList.length) {
        sendToRecipients(txList, index);
    } else {
        fs.writeFile(config.filename, JSON.stringify(payments2.concat(transactionsG)), {}, function(err) {
            if (err) {
                console.log(err);
            }
        });
    }
};


start();
