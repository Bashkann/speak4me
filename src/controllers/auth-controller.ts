import type { Request, Response } from 'express';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../schemas/auth';
import { AuthService } from '../services/auth-service';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    res.json(await this.service.login(input.email, input.password));
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await this.service.refresh(refreshToken));
  };

  logout = async (req: Request, res: Response) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await this.service.logout(refreshToken);
    res.status(204).send();
  };
}
