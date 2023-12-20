import { createAppClient } from "../../clients/createAppClient";
import { jest } from "@jest/globals";
import { viem } from "../../clients/ethereum/viem";

describe("status", () => {
  const client = createAppClient({
    relayURI: "https://connect.farcaster.xyz",
    ethereum: viem(),
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("", async () => {
    const pending1 = new Response(JSON.stringify({ state: "pending" }), {
      status: 202,
    });
    const pending2 = new Response(JSON.stringify({ state: "pending" }), {
      status: 202,
    });
    const completed = new Response(JSON.stringify({ state: "completed" }));
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(pending1)
      .mockResolvedValueOnce(pending2)
      .mockResolvedValueOnce(completed);

    const callbackSpy = jest.fn();

    const res = await client.watchStatus({
      channelToken: "some-channel-token",
      onResponse: callbackSpy,
    });

    expect(res.response.status).toEqual(200);
    expect(res.data).toEqual({ state: "completed" });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(callbackSpy).toHaveBeenCalledTimes(2);
  });
});