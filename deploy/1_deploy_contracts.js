module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const DAI = await deploy("DAI", {
    from: deployer,
    args: ["Dai Stablecoin", "DAI"]
  });
  console.log("DAI address:", DAI.address);

  const Bet = await deploy("Bet", {
    from: deployer,
    args: [DAI.address]
  });
  console.log("Bet address:", Bet.address);

  const BetOracle = await deploy("BetOracle", {
    from: deployer
  });
  console.log("BetOracle address:", BetOracle.address);

  const DefiPool = await deploy("DefiPool", {
    from: deployer,
    args: [DAI.address]
  });
  console.log("DefiPool address:", DefiPool.address);

  await execute(
    "Bet",
    { from: deployer },
    "setOracleAddress",
    BetOracle.address
  );
}
