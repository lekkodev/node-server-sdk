# Development

## Dependency code generation

We use `@bufbuild/protoc-gen-es` and `@connectrpc/protoc-gen-connect-es` to generate Buf and Connect code. See `buf.gen.yaml` for relevant options.

The following command is defined in `package.json`:

```
npm run bufgen
```
