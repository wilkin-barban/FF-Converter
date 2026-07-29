# FF-Converter

<p align="center"><img src="build/icon.png" alt="Ícone do FF-Converter" width="128"></p>

**Conversor multimídia para Windows e Ubuntu, criado para conversões em lote com FFmpeg sem exigir uma instalação separada.**

[Español](README.md) · [English](README.en.md) · Português do Brasil

## Baixar

**[Abrir a versão mais recente](https://github.com/wilkinbarban/FF-Converter/releases/latest)**

| Sistema | Arquivo recomendado |
|---|---|
| Windows 10/11 x64 | `FF-Converter-1.0.0-setup-x64.exe` |
| Ubuntu x64, portátil | `FF-Converter-1.0.0-x86_64.AppImage` |
| Ubuntu/Debian x64 | `FF-Converter-1.0.0-amd64.deb` |

FFmpeg e FFprobe já estão incluídos. Não é necessário instalá-los separadamente.

## Instalar no Windows

1. Baixe o instalador `.exe`.
2. Abra o arquivo e siga o assistente.
3. Se o Microsoft Defender SmartScreen exibir um aviso, escolha **Mais informações** e confirme que o editor é `FF-Converter Personal Development`.

Esta versão pessoal usa um certificado autoassinado. A assinatura protege a integridade do arquivo, mas o Windows ainda pode não reconhecer sua reputação.

## Instalar no Ubuntu

### AppImage

Permita executar o arquivo como programa em suas propriedades ou use:

```bash
chmod +x FF-Converter-1.0.0-x86_64.AppImage
./FF-Converter-1.0.0-x86_64.AppImage
```

### Pacote DEB

Abra o `.deb` com o instalador de aplicativos ou execute:

```bash
sudo apt install ./FF-Converter-1.0.0-amd64.deb
```

## Primeira conversão

1. Arraste vídeos, áudios ou uma pasta inteira para **Converter**.
2. Escolha a pasta de saída e um perfil.
3. Revise os trabalhos e inicie a conversão.
4. Acompanhe o progresso em **Fila**.

## Principais recursos

- Conversão em lote e controle consistente de trabalhos simultâneos.
- Perfis reutilizáveis, histórico e pastas monitoradas.
- Diagnóstico de FFmpeg, CPU e GPU.
- Console de logs com filtros, busca, cópia e limpeza.
- Troca imediata entre espanhol e inglês.
- Temas claro, escuro e do sistema.
- Recuperação de trabalhos interrompidos e validação da saída.

A aceleração depende da GPU, dos drivers e dos codificadores detectados. Quando uma opção não é compatível, o FF-Converter informa a causa e pode usar a CPU quando o perfil permite.

## Verificar um download

Cada release inclui `SHA256SUMS.txt`.

```powershell
Get-FileHash .\FF-Converter-1.0.0-setup-x64.exe -Algorithm SHA256
```

```bash
sha256sum FF-Converter-1.0.0-x86_64.AppImage
```

Compare o resultado com o checksum publicado.

## Privacidade e suporte

As conversões acontecem localmente. O FF-Converter não precisa enviar seus arquivos para nenhum serviço. Os logs ocultam a pasta pessoal e credenciais incluídas acidentalmente em URLs.

Se algo falhar, consulte **Diagnóstico** e **Console de logs** e depois abra uma [issue](https://github.com/wilkinbarban/FF-Converter/issues).

## Desenvolvimento

Requisitos: Node.js 22.12–26, npm e FFmpeg/FFprobe para desenvolvimento.

```bash
npm ci
npm run verify
npm run dev
```

Os binários redistribuíveis do FFmpeg não ficam no Git por causa do tamanho. `resources/ffmpeg/manifest.json` registra versões, URLs e hashes reproduzíveis. Consulte o [guia de desenvolvimento](doc/DEVELOPMENT.md) e o [guia de publicação](doc/RELEASE.md).

## Licenças

O código do FF-Converter usa a licença [MIT](LICENSE). Os executáveis separados FFmpeg/FFprobe incluídos nos pacotes são distribuídos sob GPLv3. Consulte os [avisos de terceiros](resources/ffmpeg/THIRD_PARTY_NOTICES.md) e o [texto da GPLv3](resources/ffmpeg/GPL-3.0.txt).

- [Guia de contribuição](CONTRIBUTING.md)
- [Política de segurança](SECURITY.md)
- [Histórico de alterações](CHANGELOG.md)
