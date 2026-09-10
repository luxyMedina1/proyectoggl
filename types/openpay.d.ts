// SDK de OpenPay (openpay.v1.min.js), cargado por <script> en runtime en los cuatro
// flujos de checkout (abonos, evento general, evento numerado, conferencia). Antes
// cada uno tenía su propio `declare global { interface Window { OpenPay: any } }`.
//
// Solo se declaran los métodos que el front usa de verdad; el SDK expone más
// (`token.create`, `card.validate*`): añadir aquí cuando se empiecen a usar.
interface OpenPaySDK {
  setId: (merchantId: string) => void;
  setApiKey: (publicKey: string) => void;
  setSandboxMode: (sandbox: boolean) => void;
  deviceData: { setup: (formId: string) => string };
}

interface Window {
  OpenPay: OpenPaySDK;
}
