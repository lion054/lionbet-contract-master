// setting up chai as following
// so that revertedWith can be called without error
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai;

const { ethers } = require("hardhat");

const { expectEvent, expectEventInConstruction, expectException } = require("./helpers");

describe("DAI", function () {
  let dai, defipool;

  beforeEach("Instantiate a DefiPool contract", async function () {
    const DAI = await ethers.getContractFactory("DAI");
    dai = await DAI.deploy("Dai Stablecoin", "DAI");
    await dai.deployed();

    const DefiPool = await ethers.getContractFactory("DefiPool");
    defipool = await DefiPool.deploy(dai.address);
    await defipool.deployed();
  });

  it.skip("getContractBalance is 0 for an address that not deposited yet", async function () {
    const amount = ethers.utils.parseEther("11");
    const [deployer] = await ethers.getSigners();

    const promise = defipool.deposit(
      amount,
      deployer.address
    );
    await expect(promise).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
  });

  it.skip("cannot deposit less than 10 DAI", async function () {
    const [deployer, customer] = await ethers.getSigners();

    await defipool.approve(
      customer.address,
      ethers.utils.parseEther("15")
    );

    const promise = defipool.deposit(
      ethers.utils.parseEther("9"),
      deployer.address
    );
    await expect(promise).to.be.revertedWith("Error, deposit must be >= 10 DAI");
  });

  it.skip("can deposit if owner", async function () {
    const [deployer, customer] = await ethers.getSigners();
    await defipool.deposit(
      ethers.utils.parseEther("10"),
      deployer.address
    );
  });

  it("can withdraw");
});
