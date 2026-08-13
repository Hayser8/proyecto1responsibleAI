import type {Request, Response} from "express";

export type HttpHandler = (request: Request, response: Response) => Promise<void>;
