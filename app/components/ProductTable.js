import React, { useState, useEffect } from "react";

export default function ProductTable({ products: propProducts, updateQuantity, deleteProduct }) {
  const [products, setProducts] = useState(propProducts || []);

  useEffect(() => {
    // Load products from localStorage
    const loadProducts = () => {
      const storedProducts = localStorage.getItem("products");
      if (storedProducts) {
        try {
          setProducts(JSON.parse(storedProducts));
        } catch (error) {
          console.error("Error parsing stored products:", error);
          setProducts([]); // Set to empty array on parsing error
        }
      }
    };

    loadProducts();

    const handleStorageChange = () => {
      loadProducts();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
        setProducts(propProducts);
  }, [propProducts])

  const handleQuantityChange = (id, delta) => {
    updateQuantity(id, delta);
  };

  const handleDelete = (productToDelete) => {
    if (window.confirm(`Are you sure you want to delete ${productToDelete.name} (Batch: ${productToDelete.batch || 'N/A'})? This action cannot be undone.`)) {
      deleteProduct(productToDelete.id, productToDelete);
    }
  };

  if (!products) {
    return <div className="p-4 text-center text-gray-500">Loading products...</div>;
  }

  if (products.length === 0) {
    return <div className="p-4 text-center text-gray-500">No products to display.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] table-auto border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left text-sm font-medium text-gray-600 uppercase">Name</th>
            <th className="border px-4 py-2 text-right text-sm font-medium text-gray-600 uppercase">Stock</th>
            <th className="border px-4 py-2 text-right text-sm font-medium text-gray-600 uppercase">Price (MRP)</th>
            <th className="border px-4 py-2 text-left text-sm font-medium text-gray-600 uppercase">Batch</th>
            <th className="border px-4 py-2 text-left text-sm font-medium text-gray-600 uppercase">Expiry Date</th>
            <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id || `${product.name}-${product.batch}-${product.expiry}`} className="hover:bg-gray-50">
              <td className="border px-4 py-2 text-sm">{product.name || "No Name"}</td>
              <td className="border px-4 py-2 text-right text-sm">{product.quantity ?? 'N/A'}</td>
              <td className="border px-4 py-2 text-right text-sm">
                ₹{product.mrp != null ? parseFloat(product.mrp).toFixed(2) : 'N/A'}
              </td>
              <td className="border px-4 py-2 text-sm">{product.batch || "N/A"}</td>
              <td className="border px-4 py-2 text-sm">{product.expiry || "N/A"}</td>
              <td className="border px-4 py-2 text-center space-x-2">
                {typeof updateQuantity === 'function' && (
                  <>
                    <button
                      onClick={() => handleQuantityChange(product.id, 1)}
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs transition duration-150"
                      title="Increase Quantity by 1"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => handleQuantityChange(product.id, -1)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs transition duration-150"
                      title="Decrease Quantity by 1"
                      disabled={product.quantity <= 0}
                    >
                      -1
                    </button>
                  </>
                )}

                {typeof deleteProduct === 'function' && (
                  <button
                    onClick={() => handleDelete(product)}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition duration-150"
                    title="Delete Product"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
