import { SiweMessage, SiweResponse, SiweError } from "siwe";
import { ResultAsync, err, ok } from "neverthrow";
import type { providers } from "ethers";
import { ConnectAsyncResult, ConnectResult, ConnectError } from "../errors";

import { validate, parseResources } from "./validate";
import { FarcasterResourceParams } from "./build";

type Hex = `0x${string}`;
type SignInOpts = {
  getFid: (custody: Hex) => Promise<BigInt>;
  provider?: providers.Provider;
};
export type VerifyResponse = Omit<SiweResponse, "error"> & FarcasterResourceParams;

const voidVerifyFid = (_custody: Hex) => Promise.reject(new Error("Not implemented: Must provide an fid verifier"));

/**
 * Verify signature of a Farcaster Connect message. Returns an error if the
 * message is invalid or the signature is invalid.
 */
export const verify = async (
  nonce: string,
  domain: string,
  message: string | Partial<SiweMessage>,
  signature: string,
  options: SignInOpts = {
    getFid: voidVerifyFid,
  },
): ConnectAsyncResult<VerifyResponse> => {
  const { getFid, provider } = options;
  const valid = validate(message)
    .andThen((message) => validateNonce(message, nonce))
    .andThen((message) => validateDomain(message, domain));
  if (valid.isErr()) return err(valid.error);

  const siwe = (await verifySiweMessage(valid.value, signature, provider)).andThen(mergeResources);
  if (siwe.isErr()) return err(siwe.error);
  if (!siwe.value.success) {
    console.log(siwe.value);
    const errMessage = siwe.value.error?.type ?? "Failed to verify SIWE message";
    return err(new ConnectError("unauthorized", errMessage));
  }

  const fid = await verifyFidOwner(siwe.value, getFid);
  if (fid.isErr()) return err(fid.error);
  if (!fid.value.success) {
    const errMessage = siwe.value.error?.type ?? "Failed to validate fid owner";
    return err(new ConnectError("unauthorized", errMessage));
  }
  const { error, ...response } = fid.value;
  return ok(response);
};

const validateNonce = (message: SiweMessage, nonce: string): ConnectResult<SiweMessage> => {
  if (message.nonce !== nonce) {
    return err(new ConnectError("unauthorized", "Invalid nonce"));
  } else {
    return ok(message);
  }
};

const validateDomain = (message: SiweMessage, domain: string): ConnectResult<SiweMessage> => {
  if (message.domain !== domain) {
    return err(new ConnectError("unauthorized", "Invalid domain"));
  } else {
    return ok(message);
  }
};

const verifySiweMessage = async (
  message: SiweMessage,
  signature: string,
  provider?: providers.Provider,
): ConnectAsyncResult<SiweResponse> => {
  return ResultAsync.fromPromise(message.verify({ signature }, { provider, suppressExceptions: true }), (e) => {
    return new ConnectError("unauthorized", e as Error);
  });
};

const verifyFidOwner = async (
  response: SiweResponse & FarcasterResourceParams,
  fidVerifier: (custody: Hex) => Promise<BigInt>,
): ConnectAsyncResult<SiweResponse & FarcasterResourceParams> => {
  const signer = response.data.address as Hex;
  return ResultAsync.fromPromise(fidVerifier(signer), (e) => {
    return new ConnectError("unavailable", e as Error);
  }).andThen((fid) => {
    if (fid !== BigInt(response.fid)) {
      response.success = false;
      response.error = new SiweError(
        `Invalid resource: signer ${signer} does not own fid ${response.fid}.`,
        response.fid.toString(),
        fid.toString(),
      );
    }
    return ok(response);
  });
};

const mergeResources = (response: SiweResponse): ConnectResult<SiweResponse & FarcasterResourceParams> => {
  return parseResources(response.data).andThen((resources) => {
    return ok({ ...resources, ...response });
  });
};
