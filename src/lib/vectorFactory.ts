import { IVectorService } from "../interface/IVectorService.js";
import { LocalVectorService } from "../services/LocalVectorService.js";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class VectorFactory {
  static create(): IVectorService {
    const type = process.env["VECTOR_STORE_TYPE"] || "local";

    switch (type) {
      case "local":
        return new LocalVectorService();
      // Futuramente: case 'cloud': return new CloudVectorService();
      default:
        throw new Error(`Tipo de Vector Store não suportado: ${type}`);
    }
  }
}

export default VectorFactory;