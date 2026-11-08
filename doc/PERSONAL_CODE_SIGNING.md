# Firma personal de Windows

FF-Converter se firma en este equipo con un certificado autofirmado confiado
únicamente para el usuario actual de Windows.

## Identidad

- Sujeto: `CN=FF-Converter Personal Development`
- SHA-1/Thumbprint: `12A84C6886FB1EAABB20BC2EA7074C7027599B75`
- Algoritmo: RSA 3072 / SHA-256
- Vencimiento: 2029-07-26
- Clave privada: no exportable, almacenada en `Cert:\CurrentUser\My`
- Copia pública: `build/certificates/FF-Converter-Personal-Development.cer`

El certificado público se instaló en los almacenes `Root` y
`TrustedPublisher` del usuario actual. Esta confianza es local: otros equipos
deben instalar explícitamente el `.cer` o usar un certificado emitido por una
CA pública. Nunca se debe presentar esta firma como confianza pública.

## Empaquetar

La configuración `win.signtoolOptions.certificateSubjectName` de
`electron-builder.yml` selecciona el certificado desde el almacén personal.
`certificateSha1` fija el thumbprint documentado para evitar otro certificado
con el mismo sujeto, y `publisherName` establece el nombre del editor:

```powershell
npm run package --workspace=apps/desktop
```

El empaquetado firma el ejecutable principal, FFmpeg, FFprobe, auxiliares,
desinstalador e instalador NSIS.

## Verificar

```powershell
Get-AuthenticodeSignature .\dist-app\FF-Converter-1.0.0-setup-x64.exe
```

El resultado esperado en este usuario es `Valid`.

## Retirar la confianza local

Antes de ejecutar estas operaciones, confirmar que el thumbprint coincide con
el indicado arriba:

```powershell
$thumbprint = '12A84C6886FB1EAABB20BC2EA7074C7027599B75'
Remove-Item "Cert:\CurrentUser\TrustedPublisher\$thumbprint"
Remove-Item "Cert:\CurrentUser\Root\$thumbprint"
Remove-Item "Cert:\CurrentUser\My\$thumbprint"
```

Al eliminar `CurrentUser\My` se destruye la única clave privada y las futuras
versiones no podrán firmarse con esta misma identidad.

## Certificado de CI (exportable)

GitHub Actions usa un segundo certificado con el mismo sujeto, creado con clave privada exportable y EKU Code Signing:

- Sujeto: `CN=FF-Converter Personal Development`
- Thumbprint: `E1662767EF188988629A4A37F261D3663BBE301F`
- Vencimiento: 2029-08-01
- Copia pública: `build/certificates/FF-Converter-Personal-Development-CI.cer`
- Secretos configurados en el repositorio: `WIN_CSC_LINK` (PFX en base64) y `WIN_CSC_KEY_PASSWORD`.

El workflow `Release` firma con este certificado cuando los secretos están presentes. Las builds locales siguen usando el certificado `12A84C...` del almacén personal. La release `v1.1.1` fue reconstruida y re-firmada con el certificado CI `E166...`; el certificado local `12A84C...` firmó la build inicial y se conserva como referencia histórica. Las releases futuras también usan el certificado CI.

Para confiar en el certificado CI en un equipo Windows, importar el `.cer` en `TrustedPublisher` y, si se requiere confianza de cadena, en `Root`. En este equipo ya está importado en `TrustedPublisher`.

## Integración continua

Los secretos `WIN_CSC_LINK` (PFX en base64) y `WIN_CSC_KEY_PASSWORD` ya están configurados con el certificado CI exportable. Si se eliminan, el workflow genera artefactos sin firma y no se deben presentar como firmados.

- Validación: el `workflow_dispatch` del 2026-11-08 (run `42433639116`) firmó Windows con `E1662767...` y construyó Linux con el archivo FFmpeg alojado en la pre-release `ffmpeg-linux64-8.1.2`.
- En un equipo sin el certificado CI en el almacén `Root`, `Get-AuthenticodeSignature` puede mostrar `UnknownError` aunque la firma exista. Importar `FF-Converter-Personal-Development-CI.cer` en `TrustedPublisher` y `Root` para obtener `Valid`.
