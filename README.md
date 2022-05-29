# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```

# How to run this contract project

Configure the hardhat network in Metamask as follows.

```shell
RPC URL: http://localhost:8545
Chain ID: 31337
Symbol: ETH
```

Get the private keys of hardhat accounts.

```shell
npx hardhat node --show-accounts
```

Import the first 3 hardhat accounts into Metamask using their private keys.
They will be used as deployer, customer and guest for contract project and frontend project.

Run the hardhat node server in localhost.

```shell
yarn dev
```

Copy the following files to `src/contracts` folder of frontend project. Because contract addresses may change whenever compiling or running contract project.

```shell
deployments/localhost/DAI.json
deployments/localhost/Bet.json
deployments/localhost/BetOracle.json
deployments/localhost/DefiPool.json
```
