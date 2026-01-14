import { Request, Response } from "express";
import { getHealth } from "./health.controller";

describe("Health Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let uptimeSpy: jest.SpyInstance;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {};
    mockResponse = {
      status: statusMock,
    } as Partial<Response>;
    uptimeSpy = jest.spyOn(process, "uptime").mockReturnValue(123.45);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return status 200", async () => {
    await getHealth(mockRequest as Request, mockResponse as Response);
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  test("should return correct response structure", async () => {
    await getHealth(mockRequest as Request, mockResponse as Response);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        timestamp: expect.any(String),
        uptime: 123.45,
        service: "EduSync-AI",
      })
    );
  });

  test("should use mocked uptime value", () => {
    expect(uptimeSpy).toBeDefined();
    expect(process.uptime()).toBe(123.45);
  });
});
