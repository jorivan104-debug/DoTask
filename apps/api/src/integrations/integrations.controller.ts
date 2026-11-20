import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';

/**
 * Configuración pública del selector de archivos de Google Drive (Google Picker).
 * DoTask no guarda archivos: el navegador pide un token de acceso con el alcance
 * `drive.file` y solo se guarda el enlace al archivo elegido.
 */
@Controller('v1/integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private config: ConfigService) {}

  @Get('google-drive')
  googleDrive() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const apiKey = this.config.get<string>('GOOGLE_PICKER_API_KEY');
    const appId = this.config.get<string>('GOOGLE_CLOUD_PROJECT_NUMBER');
    const enabled = !!(clientId && apiKey && appId);
    return enabled ? { enabled, clientId, apiKey, appId } : { enabled: false };
  }
}
