/**
 * Validación del número de tarjeta para los formularios de pago.
 *
 * Permite tarjetas de 14 a 19 dígitos y, cuando la librería de OpenPay está
 * cargada en la página, usa OpenPay.card.validateCardNumber() para verificar
 * que el número sea correcto (algoritmo de Luhn + marca de la tarjeta).
 */
export const validarNumeroTarjeta = (numeroTarjeta: string): boolean => {
  const digitos = (numeroTarjeta || "").replace(/\D/g, "");

  // Solo dígitos, entre 14 y 19 caracteres
  if (!/^\d{14,19}$/.test(digitos)) {
    return false;
  }

  // Si OpenPay está cargado, validamos con su función oficial
  const openPay = (window as { OpenPay?: any }).OpenPay;
  if (openPay?.card?.validateCardNumber) {
    return openPay.card.validateCardNumber(digitos);
  }

  return true;
};

/**
 * Validación del código de seguridad (CVV/CVC) para los formularios de pago.
 *
 * Acepta 3 o 4 dígitos y, cuando la librería de OpenPay está cargada, usa
 * OpenPay.card.validateCVC(). Si se pasa el número de tarjeta, OpenPay
 * verifica la longitud esperada según la marca (ej. American Express usa 4).
 */
export const validarCVC = (cvc: string, numeroTarjeta?: string): boolean => {
  const digitos = (cvc || "").replace(/\D/g, "");

  // 3 o 4 dígitos
  if (!/^\d{3,4}$/.test(digitos)) {
    return false;
  }

  // Si OpenPay está cargado, validamos con su función oficial
  const openPay = (window as { OpenPay?: any }).OpenPay;
  if (openPay?.card?.validateCVC) {
    const numero = (numeroTarjeta || "").replace(/\D/g, "");
    return numero
      ? openPay.card.validateCVC(digitos, numero)
      : openPay.card.validateCVC(digitos);
  }

  return true;
};
