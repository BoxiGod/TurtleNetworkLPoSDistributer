# TurtleNetworkLPoSDistributer
A revenue distribution tool for TurtleNetwork nodes

## Installation
First of all, you need to install Node.js (https://nodejs.org/en/) and NPM. Afterwards the installation of the dependencies could be done via:
```sh
mkdir node_modules
npm install
```

Once the dependencies are installed, the script that generates the payouts need to be configured. In order to do so, open appFastNGHOLD.js and change the settings of the configuration section::

```sh
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
 *     - minAmountToPayBTN: node's token min amount to pay

 */
var config = {
address: '', //put here the address of your node that you want to distribute from
alias: 'Your node alias',
startBlockHeight: 1, // put here the block from which you want to start distribution for
endBlock: 76720, // put here the block height you want to calculate the payment distribution
distributableBTNPerBlock: 10, // put here amount of node's token distributed per forged block
decimalsoftoken: 3, // put here decimals of node's token
filename: 'payments.json', // put here the file name where the payments needs to be written
node: 'http://localhost:6861', // put here the address of REST API
percentageOfFeesToDistribute: 80, // put here the percentage of fees you want to distribute
blockStorage: 'blocks.json', // put here file for storing block history
assetId: '', // put here assetId of node's token
excludeList: [''], // put here address, which won't get fee for holding node's token
percentageOfFeesToDistributeHOLDers: 20, // put here how much distribute to holders. Can be 0, if you don't have holders or don't want to distribute to them.
minAmounttoPayTN: 0, // put here TN min amount to pay
minAmountToPayBTN: 0 // put here node's token min amount to pay
};
```
After configuration, the script could be started with:
```sh
node appFastNGHOLD.js
```



## Doing the payments
For the actual payout, the massPayment.js tool needs to be run. Before it could be started, it also needs to be configured:
```sh
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
feeAssetId: null, //id of the asset used to pay the fee, null for TurtleNode
fee: 2000000 
};

```
After configuration, the script could be started with:
```sh
node massPayment.js
```
We strongly recommend to check the payments file before the actual payments are done. In order to foster these checks, we added the _checkPaymentsFile.js_ tool that could need to be configured as follows:
```sh
/**
 * Put your settings here:
 *     - filename: file to check for payments
 *     - node: address of your node in the form http://<ip>:<port
 */
var config = {
    filename: 'payments.json',
    node: 'http://localhost:6861'
};
```
After the configuration the checking tool could be executed with:
```sh
node checkPaymentsFile.js
```

## Doing payments by mass transfer transactions
First of all need to open masspay.js and edit config:
```sh
var config = {
    filename: 'payments.json', // put the file name where payments have been written.
    node: 'http://localhost:6861', // put the IP address of your REST API node
    apiKey: '', // put your secret API Key
    feeAssetId: null, // null = TN token
    feeAssetId2: "", //assetId of node's token
    fee: 2000000, // put 2000000 (0.02 TN)
    x: 0 // if 0 - check transactions, 1 - do trans. DO FIRST RUN WITH 0 TO CHECK THE TRANSACTIONS
};
```
After configuration the script should be started with:
```sh
node masspay.js
```

