// components/ProductForm.js
'use client';

import { useState } from "react";

const ProductForm = ({ formData, handleChange, handleSubmit }) => {
    return (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow-md mb-6 space-y-3">
            <div>
                <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-1">Product Name:</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter product name"
                />
            </div>
            <div>
                <label htmlFor="quantity" className="block text-gray-700 text-sm font-bold mb-1">Quantity:</label>
                <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter quantity"
                />
            </div>
            <div>
                <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-1">Price:</label>
                <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter price"
                />
            </div>
            <div>
                <label htmlFor="batch" className="block text-gray-700 text-sm font-bold mb-1">Batch:</label>
                <input
                    type="text"
                    id="batch"
                    name="batch"
                    value={formData.batch}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter batch number"
                />
            </div>
            <div>
                <label htmlFor="expiry" className="block text-gray-700 text-sm font-bold mb-1">Expiry Date:</label>
                <input
                    type="date"
                    id="expiry"
                    name="expiry"
                    value={formData.expiry || ""} // Ensure expiry is never undefined
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <button
                type="submit"
                onClick={handleSubmit}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
                Add Product
            </button>
        </form>
    );
};

export default ProductForm;