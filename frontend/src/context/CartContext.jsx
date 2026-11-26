import { useState } from 'react';
import { CartContext } from './cart-context';

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (product, quantity) => {
    if (cart.length && cart[0].product.tenant_id !== product.tenant_id) {
      return 'El carrito solo puede incluir productos de un mismo club, porque cada club recibe sus pagos por separado.';
    }

    const parsedQty = Number.parseInt(quantity, 10) || 1;
    const existing = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const requestedTotal = currentQtyInCart + parsedQty;

    if (requestedTotal > product.stock) {
      return `Stock insuficiente para "${product.name}". Stock disponible: ${product.stock}, ya tienes ${currentQtyInCart} en el carrito.`;
    }

    setCart(existing
      ? cart.map(item => item.product.id === product.id ? { ...item, quantity: requestedTotal } : item)
      : [...cart, { product, quantity: parsedQty }]);
    return null;
  };

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart }}>
      {children}
    </CartContext.Provider>
  );
}
