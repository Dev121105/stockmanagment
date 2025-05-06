"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/button'; // Adjust path as per your project structure
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path as per your project structure
import { toast } from 'sonner'; // Assuming you use Sonner for toasts
import { Plus, Trash2, Edit } from 'lucide-react'; // Icons

const ProductMasterPage = () => {
    // State for the product form - Removed schedule and barcode, Min/Max Stock, Discount, Tax Rate are optional
    const [productForm, setProductForm] = useState({
        name: '',
        unit: '',
        category: '', // Keep category as text for datalist input
        company: '', // Keep company as text for datalist input
        itemsPerPack: '', // New field for items per pack, required > 0
        minStock: '', // Optional
        maxStock: '', // Optional
        mrp: '', // Maximum Retail Price (Selling Price per Item), required >= 0
        discount: '', // Default discount for this product, Optional
        taxRate: '', // Tax/VAT percentage, Optional (but validated if entered)
        // Removed schedule and barcode
    });

    // State for the list of all products
    const [products, setProducts] = useState([]);

    // State for editing
    const [editingProduct, setEditingProduct] = useState(null); // Holds the product being edited

    // Predefined list of categories for suggestions
    const predefinedCategories = [
        'Tablet',
        'Capsule',
        'Syrup',
        'Injection',
        'Cream',
        'Ointment',
        'Drops',
        'Powder',
        'Liquid',
        'Suspension',
        'Suppository',
        'Inhaler',
        'Medical Device',
        'Other',
    ];

    // --- EXPANDED: Predefined list of companies for suggestions ---
    const predefinedCompanies = [
        'Cipla Ltd.',
        'Sun Pharmaceutical Industries Ltd.',
        'Dr. Reddy\'s Laboratories Ltd.',
        'Zydus Lifesciences Ltd.',
        'Lupin Ltd.',
        'Torrent Pharmaceuticals Ltd.',
        'Glenmark Pharmaceuticals Ltd.',
        'Mankind Pharma Ltd.',
        'Abbott India Ltd.',
        'Pfizer Ltd.',
        'Novartis India Ltd.',
        'Sanofi India Ltd.',
        'GlaxoSmithKline Pharmaceuticals Ltd.',
        'Divi\'s Laboratories Ltd.',
        'Aurobindo Pharma Ltd.',
        'Biocon Ltd.',
        'Alkem Laboratories Ltd.',
        'Natco Pharma Ltd.',
        'Ipca Laboratories Ltd.',
        'Laurus Labs Ltd.',
        'Ajanta Pharma Ltd.',
        'Wockhardt Ltd.',
        'Emcure Pharmaceuticals Ltd.',
        'Macleods Pharmaceuticals Ltd.',
        'Intas Pharmaceuticals Ltd.',
        'Micro Labs Ltd.',
        'Aristo Pharmaceuticals Pvt Ltd.',
        'Franco-Indian Pharmaceuticals Pvt Ltd.',
        'Eris Lifesciences Ltd.',
        'Hetero Drugs Ltd.',
        'Cadila Pharmaceuticals Ltd.',
        'Serum Institute of India Pvt. Ltd.',
        'Gland Pharma Ltd.', // Added
        'Granules India Ltd.', // Added
        'Jubilant Pharmova Ltd.', // Added
        'Syngene International Ltd.', // Added
        'Suven Pharmaceuticals Ltd.', // Added
        'P&G Health Ltd.', // Added
        'Astellas Pharma Inc.', // Added
        'Bayer Pharmaceuticals Pvt. Ltd.', // Added
        'Boehringer Ingelheim India Pvt. Ltd.', // Added
        'Eli Lilly and Company (India) Pvt. Ltd.', // Added
        'Merck Sharp & Dohme (India) Pvt. Ltd. (MSD)', // Added
        'Novo Nordisk India Pvt. Ltd.', // Added
        'Roche Products (India) Pvt. Ltd.', // Added
        'Takeda Pharmaceuticals India Pvt. Ltd.', // Added
        'UCB India Pvt. Ltd.', // Added
        'Viatris Inc.', // Added
        'Zuventus Healthcare Ltd.', // Added
        'Akums Drugs & Pharmaceuticals Ltd.', // Added
        'Nestor Pharmaceuticals Ltd.', // Added
        'Indoco Remedies Ltd.', // Added
        'Unichem Laboratories Ltd.', // Added
        'Wallace Pharmaceuticals Pvt. Ltd.', // Added
        'FDC Ltd.', // Added
        'Knoll Healthcare Pvt. Ltd.', // Added
        'Bharat Serums and Vaccines Ltd.', // Added
        'La Renon Healthcare Pvt. Ltd.', // Added
        'Corona Remedies Pvt. Ltd.', // Added
        'Lincoln Pharmaceuticals Ltd.', // Added
        'Sharon Bio-Medicine Ltd.', // Added
        'Morepen Laboratories Ltd.', // Added
        'Lyka Labs Ltd.', // Added
        'Bliss GVS Pharma Ltd.', // Added
        'Alniche Life Sciences Pvt Ltd.', // Added
        'Apex Laboratories Pvt. Ltd.', // Added
        'Cachet Pharmaceuticals Pvt. Ltd.', // Added
        'Concept Pharmaceuticals Ltd.', // Added
        'Elder Pharmaceuticals Ltd.', // Added
        'Fourrts (India) Laboratories Pvt Ltd.', // Added
        'Galpha Laboratories Ltd.', // Added
        'Ind Swift Laboratories Ltd.', // Added
        'Intas Pharmaceuticals Ltd.', // Added (already there, maybe just keep one) - Keeping it as it might be listed differently
        'Ipca Laboratories Ltd.', // Added (already there, maybe just keep one) - Keeping it as it might be listed differently
        'JB Chemicals & Pharmaceuticals Ltd.', // Added
        'Kamron Laboratories Ltd.', // Added
        'Kumarswamy Pharmaceutical Works (KSPW)', // Added
        'Lupin Ltd.', // Added (already there)
        'Mankind Pharma Ltd.', // Added (already there)
        'Meditrina Pharmaceuticals Pvt Ltd.', // Added
        'Meyer Organics Pvt. Ltd.', // Added
        'Novartis India Ltd.', // Added (already there)
        'Ordain Health Care Global Pvt Ltd.', // Added
        'Ranbaxy Laboratories Ltd.', // Added (part of Sun Pharma now, but historically significant)
        'Reliance Life Sciences Pvt. Ltd.', // Added
        'RPG Life Sciences Ltd.', // Added
        'S.L. Healthcare', // Added
        'Serum Institute of India Pvt. Ltd.', // Added (already there)
        'Shemaroo Pharmaceutical Pvt Ltd.', // Added
        'Strides Pharma Science Ltd.', // Added (formerly Strides Shasun)
        'Synchem Pharmaceuticals Ltd.', // Added
        'Themis Medicare Ltd.', // Added
        'TTK Healthcare Ltd.', // Added
        'Unichem Laboratories Ltd.', // Added (already there)
        'Unique Pharmaceutical Laboratories', // Added (division of JB Chemicals)
        'Venus Remedies Ltd.', // Added
        'Wockhardt Ltd.', // Added (already there)
        'Zydus Healthcare Ltd.', // Added (division of Zydus Lifesciences)
        'Other',
    ];


    const router = useRouter(); // Assuming Next.js router


    // Load products from localStorage on component mount
    useEffect(() => {
        const storedProducts = localStorage.getItem('products');
        if (storedProducts) {
            try {
                const parsedProducts = JSON.parse(storedProducts);
                 // Ensure numeric fields are numbers on load, and include new field, handling potential missing fields
                const productsWithFormattedData = parsedProducts.map(product => ({
                    ...product,
                    // Use || 0 or || 1 for defaults if data is missing or invalid
                    itemsPerPack: Number(product.itemsPerPack) || 1, // Default to 1 if missing/invalid
                    minStock: Number(product.minStock) || 0, // Default to 0
                    maxStock: Number(product.maxStock) || 0, // Default to 0
                    mrp: Number(product.mrp) || 0, // Default to 0
                    discount: Number(product.discount) || 0, // Default to 0
                    taxRate: Number(product.taxRate) || 0, // Default to 0
                    quantity: Number(product.quantity) || 0, // Stock is tracked in individual items
                    // Explicitly set removed fields to undefined to clean old data on load
                    hsn: undefined,
                    schedule: undefined,
                    barcode: undefined,
                    // Also ensure batch and expiry are not on master product objects
                    batch: undefined,
                    expiry: undefined,
                 })).filter(product => product.name); // Filter out any entries without a name

                setProducts(productsWithFormattedData);
            } catch (error) {
                console.error("Error loading products from localStorage:", error);
                setProducts([]); // Clear products if parsing fails
                toast.error("Error loading product data. Local storage might be corrupted."); // Inform the user
            }
        } else {
                 setProducts([]); // Initialize with an empty array if nothing is found
        }
    }, []); // Empty dependency array means this runs only once on mount


    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
         // For numeric fields that are optional, allow empty string, convert later
         // For required numeric fields (itemsPerPack, mrp, taxRate validation is stricter)
         if (['minStock', 'maxStock', 'discount'].includes(name)) {
             setProductForm({ ...productForm, [name]: value });
         } else {
             setProductForm({ ...productForm, [name]: value });
         }
    };

    // Validate form data - Only require Name, Unit, Items per Pack (>0), and MRP (>=0)
    const validateForm = () => {
        const { name, unit, itemsPerPack, mrp, taxRate } = productForm;

        if (!name.trim()) {
            toast.error('Product Name is required.');
            return false;
        }
        if (!unit.trim()) {
            toast.error('Unit is required.');
            return false;
        }

         // Items per Pack validation
        const itemsPerPackNum = Number(itemsPerPack);
        if (itemsPerPack.trim() === '' || isNaN(itemsPerPackNum) || itemsPerPackNum <= 0) {
            toast.error('Valid "Items per Pack" is required and must be a number greater than 0.');
            return false;
        }

        // MRP validation
        const mrpNum = Number(mrp);
         if (mrp.trim() === '' || isNaN(mrpNum) || mrpNum < 0) {
             toast.error('Valid "MRP (Selling Price)" is required and must be 0 or greater.'); // Clarify MRP
             return false;
         }

        // Tax Rate validation (optional field, but validate if entered)
        const taxRateNum = Number(taxRate);
         if (taxRate.trim() !== '' && (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100)) {
             toast.error('Valid "Tax Rate (%)" must be between 0 and 100 if entered.'); // Clarify Tax Rate
             return false;
         }

        // No validation needed for category, company, minStock, maxStock, discount (they are optional/default to 0)
        return true;
    };

    // Handle adding or updating a product
    const handleSaveProduct = () => {
        if (!validateForm()) {
            return; // Stop if validation fails
        }

        const productData = {
            id: editingProduct ? editingProduct.id : Date.now() + Math.random(), // Use existing ID if editing, otherwise generate new
            name: productForm.name.trim(),
            unit: productForm.unit.trim(),
            category: productForm.category.trim(),
            company: productForm.company.trim(),
            itemsPerPack: Number(productForm.itemsPerPack), // Store items per pack as number
            minStock: Number(productForm.minStock) || 0, // Default to 0 if empty or invalid
            maxStock: Number(productForm.maxStock) || 0, // Default to 0 if empty or invalid
            mrp: Number(productForm.mrp), // Store MRP as number
            discount: Number(productForm.discount) || 0, // Default to 0 if empty or invalid
            taxRate: Number(productForm.taxRate) || 0, // Default to 0 if empty or invalid
            // Removed schedule and barcode from product data
            // Preserve existing quantity (individual items) when editing, initialize to 0 for new products
            quantity: editingProduct ? Number(editingProduct.quantity) || 0 : 0, // Quantity should ideally be managed separately per batch/stock entry, but keeping consistent with original structure for now.
        };

        let updatedProducts;
        if (editingProduct) {
             // Check for name conflict during edit (if name is changed)
             const nameConflict = products.some(p =>
                 p.name.toLowerCase() === productData.name.toLowerCase() && p.id !== productData.id
             );
             if (nameConflict) {
                 toast.error(`Another product with the name "${productData.name}" already exists.`);
                 return; // Stop the update
             }
            // Update existing product, preserving its current quantity
            updatedProducts = products.map(p =>
                p.id === productData.id ? { ...productData, quantity: p.quantity } : p // Preserve quantity
            );
            toast.success(`Product "${productData.name}" updated successfully!`);
        } else {
            // Add new product
            // Check if a product with the same name already exists before adding
            if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase())) {
                toast.error(`Product with name "${productData.name}" already exists.`);
                return; // Stop the add
            }
            updatedProducts = [...products, productData];
            toast.success(`Product "${productData.name}" added successfully!`);
        }

        setProducts(updatedProducts);
        localStorage.setItem('products', JSON.stringify(updatedProducts));

        // Dispatch a custom event so other components can react to product list changes
        window.dispatchEvent(new Event('productsUpdated'));

        // Reset form and editing state
        resetForm();
    };

    // Handle editing a product
    const handleEditProduct = (product) => {
        setEditingProduct(product);
        // Populate the form with product data (convert numbers back to strings for input fields), handle potential missing data
        setProductForm({
            name: product.name || '',
            unit: product.unit || '',
            category: product.category || '',
            company: product.company || '',
            itemsPerPack: String(product.itemsPerPack || '') || '', // Populate items per pack
            minStock: String(product.minStock || '') || '', // Populate min stock
            maxStock: String(product.maxStock || '') || '', // Populate max stock
            mrp: String(product.mrp || '') || '', // Populate MRP
            discount: String(product.discount || '') || '', // Populate discount
            taxRate: String(product.taxRate || '') || '', // Populate tax rate
            // Removed schedule and barcode from form population
        });
    };

    // Handle deleting a product
    const handleDeleteProduct = (productId, productName) => {
        if (window.confirm(`Are you sure you want to delete product "${productName}"? This will NOT automatically adjust stock quantities in past purchases/sales.`)) {
            const updatedProducts = products.filter(p => p.id !== productId);
            setProducts(updatedProducts);
            localStorage.setItem('products', JSON.stringify(updatedProducts));

            // Dispatch event
            window.dispatchEvent(new Event('productsUpdated'));

            toast.success(`Product "${productName}" deleted.`);
             // If the deleted product was being edited, reset the form
             if (editingProduct && editingProduct.id === productId) {
                 resetForm();
             }
        }
    };

    // Reset the form and editing state
    const resetForm = () => {
        setProductForm({
            name: '',
            unit: '',
            category: '',
            company: '',
            itemsPerPack: '',
            minStock: '',
            maxStock: '',
            mrp: '',
            discount: '',
            taxRate: '',
            // Removed schedule and barcode
        });
        setEditingProduct(null);
    };


    return (
        <div>
            <Header />
            <div className="container mx-auto p-6 bg-white shadow-md rounded-lg">
                <div className="flex justify-between items-center mb-4"> {/* Use justify-between */}
                    <h2 className="text-2xl font-semibold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                    {/* Link back to the Dashboard */}
                    <Button onClick={() => router.push("/")} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">Go to Dashboard</Button>
                </div>


                {/* Product Form */}
                {/* Adjusted grid columns for better layout with fewer fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <input
                        type="text"
                        name="name"
                        placeholder="Product Name (Required)"
                        className="border p-2 rounded"
                        value={productForm.name}
                        onChange={handleInputChange}
                        required // Mark as required in HTML5 validation as well
                    />
                    <input
                        type="text"
                        name="unit"
                        placeholder="Unit (e.g., Pcs, Bottle) (Required)"
                        className="border p-2 rounded"
                        value={productForm.unit}
                        onChange={handleInputChange}
                        required // Mark as required in HTML5 validation as well
                    />
                    <input
                        type="text"
                        name="category"
                        placeholder="Category"
                        className="border p-2 rounded"
                        value={productForm.category}
                        onChange={handleInputChange}
                        list="category-suggestions" // Added list attribute
                    />
                    {/* Datalist for Category Suggestions */}
                    <datalist id="category-suggestions">
                        {predefinedCategories.map((category, index) => (
                            <option key={index} value={category} />
                        ))}
                    </datalist>

                    <input
                        type="text"
                        name="company"
                        placeholder="Company/Manufacturer"
                        className="border p-2 rounded"
                        value={productForm.company}
                        onChange={handleInputChange}
                        list="company-suggestions" // Added list attribute
                    />
                    {/* Datalist for Company Suggestions (Updated) */}
                    <datalist id="company-suggestions">
                        {predefinedCompanies.map((company, index) => (
                            <option key={index} value={company} />
                        ))}
                    </datalist>

                     {/* Input field for Items per Pack (Required > 0) */}
                     <input
                         type="number"
                         name="itemsPerPack"
                         placeholder="Items per Pack (Required > 0)"
                         className="border p-2 rounded"
                         value={productForm.itemsPerPack}
                         onChange={handleInputChange}
                         min="1" // HTML5 validation hint
                         required // Mark as required in HTML5 validation
                     />

                     {/* Input field for MRP (Selling Price) (Required >= 0) */}
                     <input
                         type="number"
                         name="mrp"
                         placeholder="MRP (Selling Price per Item) (Required)"
                         className="border p-2 rounded"
                         value={productForm.mrp}
                         onChange={handleInputChange}
                         min="0" // HTML5 validation hint
                         step="0.01" // Allow decimal places for currency
                         required // Mark as required in HTML5 validation
                     />

                    {/* Input field for Minimum Stock (Optional) */}
                    <input
                        type="number"
                        name="minStock"
                        placeholder="Minimum Stock (Items)"
                        className="border p-2 rounded"
                        value={productForm.minStock}
                        onChange={handleInputChange}
                        min="0"
                    />
                    {/* Input field for Maximum Stock (Optional) */}
                    <input
                        type="number"
                        name="maxStock"
                        placeholder="Maximum Stock (Items)"
                        className="border p-2 rounded"
                        value={productForm.maxStock}
                        onChange={handleInputChange}
                        min="0"
                    />
                    {/* Input field for Default Discount (%) (Optional) */}
                    <input
                        type="number"
                        name="discount"
                        placeholder="Default Discount (%)"
                        className="border p-2 rounded"
                        value={productForm.discount}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                    />
                     {/* Input field for Tax Rate (%) (Optional) */}
                     <input
                         type="number"
                         name="taxRate"
                         placeholder="Tax Rate (%)"
                         className="border p-2 rounded"
                         value={productForm.taxRate}
                         onChange={handleInputChange}
                         min="0"
                         max="100"
                     />

                    {/* Removed schedule and barcode input fields */}

                </div>

                {/* Save/Update and Cancel Buttons */}
                <div className="flex justify-start space-x-2 mb-6">
                    <Button onClick={handleSaveProduct} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                        {editingProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                    {editingProduct && (
                        <Button onClick={resetForm} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">
                            Cancel Edit
                        </Button>
                    )}
                </div>

                {/* Product List Table */}
                <h3 className="text-xl font-semibold mb-2">Product List</h3>
                 <div className="overflow-x-auto"> {/* Added overflow for responsiveness */}
                    <table className="w-full table-auto border-collapse border border-gray-300"> {/* Added border-collapse */}
                        <thead>
                            {/* Updated headers to include Items per Pack and clarify stock unit, removed schedule/barcode */}
                            <tr className="bg-gray-100 text-left"> {/* Added text-left */}
                                <th className="border border-gray-300 px-4 py-2">Name</th>
                                <th className="border border-gray-300 px-4 py-2">Unit</th>
                                <th className="border border-gray-300 px-4 py-2">Category</th>
                                <th className="border border-gray-300 px-4 py-2">Company</th>
                                <th className="border border-gray-300 px-4 py-2">Items/Pack</th> {/* New header, shortened */}
                                <th className="border border-gray-300 px-4 py-2">Min Stock (Items)</th> {/* Clarified unit */}
                                <th className="border border-gray-300 px-4 py-2">Max Stock (Items)</th> {/* Clarified unit */}
                                <th className="border border-gray-300 px-4 py-2">MRP (per Item)</th> {/* Clarified unit */}
                                <th className="border border-gray-300 px-4 py-2">Discount (%)</th>
                                <th className="border border-gray-300 px-4 py-2">Tax Rate (%)</th>
                                {/* Removed Schedule and Barcode headers */}
                                <th className="border border-gray-300 px-4 py-2">Current Stock (Items)</th>{/* Display current stock in items */}
                                <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>{/* Centered actions header */}
                            </tr>
                        </thead>
                        <tbody>
                            {products.length > 0 ? (
                                products.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50"> {/* Added hover effect */}
                                        <td className="border border-gray-300 px-4 py-2">{product.name}</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.unit}</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.category}</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.company}</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.itemsPerPack}</td> {/* Display items per pack */}
                                        <td className="border border-gray-300 px-4 py-2">{product.minStock}</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.maxStock}</td>
                                        <td className="border border-gray-300 px-4 py-2">₹{Number(product.mrp).toFixed(2)}</td>{/* Display MRP formatted */}
                                        <td className="border border-gray-300 px-4 py-2">{product.discount}%</td>
                                        <td className="border border-gray-300 px-4 py-2">{product.taxRate}%</td>
                                        {/* Removed Schedule and Barcode data cells */}
                                        <td className="border border-gray-300 px-4 py-2">{product.quantity}</td>{/* Display current stock */}
                                        <td className="border border-gray-300 px-4 py-2 text-center"> {/* Centered actions */}
                                            <div className="flex justify-center space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)} className="text-yellow-600 hover:text-yellow-800 p-1"><Edit className="h-4 w-4" /></Button> {/* Added padding, adjusted colors */}
                                                <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product.id, product.name)} className="bg-red-600 hover:bg-red-700 text-white p-1"><Trash2 className="h-4 w-4" /></Button> {/* Added padding, adjusted colors */}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    {/* Adjusted colSpan - Count the remaining table headers */}
                                     <td colSpan="12" className="border border-gray-300 px-4 py-2 text-center">No products found</td> {/* 12 columns remaining */}
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

export default ProductMasterPage;