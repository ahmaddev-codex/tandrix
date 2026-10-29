// Images bundled by Metro: importing one gives a source for <Image> and <ImageBackground>.
declare module "*.jpg" {
  import type { ImageSourcePropType } from "react-native";
  const source: ImageSourcePropType;
  export default source;
}
