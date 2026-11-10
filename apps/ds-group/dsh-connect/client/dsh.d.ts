// The parts of DSH's browser platform this page uses beyond React, which DSH supplies at run time.
/** The bundled native Bot workspace, prepended to the published client by the npm packer when it ships one. */
declare const dscordNativeFactory:
  ((require: (name: string) => unknown) => unknown) | undefined;
/** The module loader's own require, in scope inside the factory the build wraps this bundle in. */
declare const require: (name: string) => unknown;

/** Images the build inlines as data URLs. */
declare module "*.png" {
  const url: string;
  export default url;
}
