"use client";
import { useState, useEffect } from "react";
import ProductForm from "./ProductForm";
import ProductTable from "./ProductTable";

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    price: "",
    batch: "",
    expiry: "",
  });

  // Load products from localStorage on initial load
  useEffect(() => {
    const storedProducts = localStorage.getItem("products");
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    }
  }, []);

  // Save products to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("products", JSON.stringify(products));
  }, [products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newProduct = {
      id: Date.now(),
      name: formData.name,
      quantity: Number(formData.quantity),
      price: Number(formData.price),
      batch: formData.batch,
      expiry: formData.expiry,
    };

    setProducts((prev) => [...prev, newProduct]);

    setFormData({
      name: "",
      quantity: "",
      price: "",
      batch: "",
      expiry: "",
    });
  };

  const updateQuantity = (id, change) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? { ...product, quantity: product.quantity + change }
          : product
      )
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Stock Management</h1>
      <ProductForm
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
      />
      <ProductTable products={products} updateQuantity={updateQuantity} />
    </div>
  );
}
