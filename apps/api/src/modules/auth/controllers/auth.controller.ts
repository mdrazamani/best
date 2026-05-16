import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { LogoutDto } from '../dto/logout.dto';

@Resource('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Req() request: { headers?: Record<string, string | undefined>; ip?: string }, @Body() dto: LoginDto) {
    return this.authService.login({
      username: dto.username,
      password: dto.password,
      context: {
        ...(request.headers ?? {}),
        ip: request.ip
      }
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: CurrentUserPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user.userId, dto.sessionId);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }
}
