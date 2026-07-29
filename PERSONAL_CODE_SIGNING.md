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
`electron-builder.yml` selecciona el certificado desde el almacén personal:

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
