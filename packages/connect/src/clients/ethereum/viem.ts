import { Hex, createPublicClient, http } from "viem";
import { optimism } from "viem/chains";
import { providers } from "ethers";
import { ID_REGISTRY_ADDRESS, idRegistryABI } from "../../contracts/idRegistry";

export interface Ethereum {
  getFid: (custody: Hex) => Promise<BigInt>;
  provider: providers.JsonRpcProvider;
}

interface ViemConfigArgs {
  rpcUrl?: string;
}

export const viem = (args?: ViemConfigArgs): Ethereum => {
  const publicClient = createPublicClient({
    chain: optimism,
    transport: http(args?.rpcUrl),
  });

  const getFid = async (custody: Hex): Promise<BigInt> => {
    return publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: "idOf",
      args: [custody],
    });
  };

  const getProvider = () => {
    const { chain, transport } = publicClient;
    const network = {
      chainId: chain.id,
      name: chain.name,
    };
    const rpc = transport.url ?? chain.rpcUrls.default.http[0];
    return new providers.JsonRpcProvider(rpc, network);
  };

  return {
    getFid,
    provider: getProvider(),
  };
};
