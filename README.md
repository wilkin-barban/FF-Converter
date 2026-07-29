# FF-Converter

<p align="center"><img src="build/icon.png" alt="Icono de FF-Converter" width="128"></p>

**Conversor multimedia de escritorio para Windows y Ubuntu, preparado para procesar archivos por lotes con FFmpeg sin exigir una instalación externa.**

Español · [English](README.en.md) · [Português do Brasil](README.pt-BR.md)

## Descargar

**[Abrir la versión más reciente](https://github.com/wilkinbarban/FF-Converter/releases/latest)**

| Sistema | Archivo recomendado |
|---|---|
| Windows 10/11 x64 | `FF-Converter-1.0.0-setup-x64.exe` |
| Ubuntu x64, portátil | `FF-Converter-1.0.0-x86_64.AppImage` |
| Ubuntu/Debian x64 | `FF-Converter-1.0.0-amd64.deb` |

FFmpeg y FFprobe ya están incluidos. No es necesario instalarlos por separado.

## Instalar en Windows

1. Descargue el instalador `.exe`.
2. Ábralo y siga el asistente.
3. Si Microsoft Defender SmartScreen muestra una advertencia, seleccione **Más información** y confirme que el editor sea `FF-Converter Personal Development`.

Esta versión personal utiliza un certificado autofirmado. La firma protege la integridad del archivo, pero Windows todavía puede no reconocer su reputación.

## Instalar en Ubuntu

### AppImage

En las propiedades del archivo, habilite **Ejecutar como programa**, o use:

```bash
chmod +x FF-Converter-1.0.0-x86_64.AppImage
./FF-Converter-1.0.0-x86_64.AppImage
```

### Paquete DEB

Abra el `.deb` con el instalador de aplicaciones o ejecute:

```bash
sudo apt install ./FF-Converter-1.0.0-amd64.deb
```

## Primera conversión

1. Arrastre videos, audios o una carpeta completa a **Convertir**.
2. Seleccione la carpeta de salida y un perfil.
3. Revise los trabajos e inicie la conversión.
4. Siga el progreso desde **Cola**.

## Funciones principales

- Conversión por lotes y control coherente de trabajos simultáneos.
- Perfiles reutilizables, historial y carpetas vigiladas.
- Diagnóstico de FFmpeg, CPU y aceleración GPU.
- Consola de logs con filtros, búsqueda, copia y limpieza.
- Interfaz en español e inglés con cambio en vivo.
- Temas claro, oscuro y del sistema.
- Recuperación de trabajos interrumpidos y validación de salidas.

La aceleración depende de la GPU, sus controladores y los codificadores detectados. Cuando una opción no es compatible, FF-Converter informa la causa y puede utilizar CPU cuando el perfil lo permite.

## Verificar una descarga

Cada release incluye `SHA256SUMS.txt`.

```powershell
Get-FileHash .\FF-Converter-1.0.0-setup-x64.exe -Algorithm SHA256
```

```bash
sha256sum FF-Converter-1.0.0-x86_64.AppImage
```

Compare el resultado con el valor publicado.

## Privacidad y soporte

Las conversiones se ejecutan localmente. FF-Converter no necesita subir los archivos a ningún servicio. Los logs ocultan el directorio personal y las credenciales incluidas accidentalmente en URLs.

Si algo falla, revise **Diagnóstico** y **Consola Logs** y luego abra una [issue](https://github.com/wilkinbarban/FF-Converter/issues).

## Desarrollo

Requisitos: Node.js 20–26, npm y FFmpeg/FFprobe para desarrollo.

```bash
npm ci
npm run verify
npm run dev
```

Los binarios redistribuibles de FFmpeg no se guardan en Git por su tamaño. `resources/ffmpeg/manifest.json` conserva las versiones, URLs y hashes reproducibles. Consulte la [guía de desarrollo](doc/DEVELOPMENT.md) y la [guía de publicación](doc/RELEASE.md).

## Licencias

El código de FF-Converter se publica bajo [MIT](LICENSE). Los ejecutables separados FFmpeg/FFprobe incluidos en las distribuciones se entregan bajo GPLv3. Consulte los [avisos de terceros](resources/ffmpeg/THIRD_PARTY_NOTICES.md) y la [licencia GPLv3](resources/ffmpeg/GPL-3.0.txt).

- [Guía de contribución](CONTRIBUTING.md)
- [Política de seguridad](SECURITY.md)
- [Historial de cambios](CHANGELOG.md)
