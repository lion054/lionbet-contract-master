// setting up chai as following
// so that revertedWith can be called without error
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai;

const { ethers } = require("hardhat");

const { expectEvent, expectEventInConstruction } = require("./helpers");

describe("DAI", function () {
  let dai;

  beforeEach("Create a DAI before running each test in this suite", async function () {
    const DAI = await ethers.getContractFactory("DAI");
    dai = await DAI.deploy("Dai Stablecoin", "DAI");
    await dai.deployed();
  });

  it("has a name", async function () {
    expect(await dai.name()).to.equal("Dai Stablecoin");
  });

  it("has a symbol", async function () {
    expect(await dai.symbol()).to.equal("DAI");
  });

  it("has a 18 decimals", async function () {
    expect(await dai.decimals()).to.be.a("number").equal(18);
  });

  it("has a totalSupply", async function () {
    expect(await dai.totalSupply()).to.equal(ethers.utils.parseEther("100"));
  });

  it.skip("allow the total supply to the owner", async function () {
    const [deployer] = await ethers.getSigners();
    const totalSupply = await dai.totalSupply();
    const deployerBalance = await dai.balanceOf(deployer.address);
    expect(deployerBalance).to.equal(totalSupply);
    // TODO: Fix me, `expectEvent.inConstruction` is defintely my "Bad Batch"!
    // Not working hand in hand with Chai/Mocka
    await expectEventInConstruction(dai, "IERC20.Transfer", {
      from: ethers.constants.AddressZero,
      to: deployer.address,
      value: totalSupply
    });
  });

  specify("Default balanceOf an account is 0", async function () {
    const [deployer, customer, guest] = await ethers.getSigners();
    expect(await dai.balanceOf(guest.address)).to.equal(ethers.constants.Zero);
  });

  it("cannot transfer from or to address 0", async function () {
    const amount = ethers.utils.parseEther("50");
    const [deployer, customer, guest] = await ethers.getSigners();

    const promise0 = dai.transferFrom(
      ethers.constants.AddressZero,
      guest.address,
      amount
    );
    await expect(promise0).to.be.revertedWith("ERC20: transfer from the zero address");

    const promise1 = dai.transferFrom(
      deployer.address,
      ethers.constants.AddressZero,
      amount
    );
    await expect(promise1).to.be.revertedWith("ERC20: transfer to the zero address");
  });

  it("can approve address2 to spend 50 DAIs on behalf of ownerAddress", async function () {
    const amount = ethers.utils.parseEther("50");
    const [deployer, customer, guest] = await ethers.getSigners();

    const tx = await dai.approve(
      guest.address,
      amount
    );
    expectEvent(tx, "Approval", {
      owner: deployer.address,
      spender: guest.address,
      value: amount
    });
  });

  it("can transfer DAI from an address to another one", async function () {
    // TODO: Find and use something more explicit because "ether" is misleading when testing DAI!
    // Both Ether and DAI have 18 decimals ;-)
    const amount = ethers.utils.parseEther("50");
    const totalSupply = await dai.totalSupply();
    const [deployer, customer, guest] = await ethers.getSigners();

    await dai.approve(deployer.address, amount);
    expect(await dai.allowance(deployer.address, deployer.address)).to.equal(amount);

    expect(await dai.balanceOf(deployer.address)).to.equal(totalSupply);
    await dai.transferFrom(deployer.address, guest.address, amount);
    expect(await dai.balanceOf(guest.address)).to.equal(amount);
    expect(await dai.balanceOf(deployer.address)).to.equal(amount);

    expect(await dai.allowance(deployer.address, deployer.address)).to.equal(ethers.constants.Zero);

    expect(await dai.allowance(deployer.address, guest.address)).to.equal(ethers.constants.Zero);
    await dai.approve(guest.address, amount);
    expect(await dai.allowance(deployer.address, guest.address)).to.equal(amount);
  });
});
