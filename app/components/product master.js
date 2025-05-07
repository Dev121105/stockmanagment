// app/productmaster/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect } from 'react'; // Removed useCallback as it wasn't used
import { Button } from '../components/button'; // Adjust path as per your project structure
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path as per your project structure
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Edit,
    Package,
    Search,
    Tag,
    Ruler, // Icon for Unit
    List, // Icon for Category
    Building2, // Icon for Company
    Boxes, // Icon for Items Per Pack
    ArrowDownCircle, // Icon for Min Stock
    ArrowUpCircle, // Icon for Max Stock
    DollarSign, // Changed from Currency for better visual if available, or stick to Currency
    Percent,
    Scale,
    X,
    Save // Added Save icon
} from 'lucide-react';

const ProductMasterPage = () => {
    const [productForm, setProductForm] = useState({
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
    });

    const [products, setProducts] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]); // This will now be derived directly in the JSX

    const predefinedUnits = [
        'Pcs', 'Bottle', 'Strip', 'Box', 'Tube', 'Gm', 'Kg', 'Ml', 'Liter',
        'Capsule', 'Tablet', 'Pack', 'Each', 'Vial', 'Ampoule', 'Can',
        'Jar', 'Roll', 'Sheet', 'Pair', 'Kit', 'Set', 'Dozen', 'Gross'
    ];

    const predefinedCategories = [
        'Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops',
        'Powder', 'Liquid', 'Suspension', 'Suppository', 'Inhaler', 'Medical Device', 'Other',
    ];

    // Abridged list for example; use your comprehensive list
    const predefinedCompanies = [
        'Cipla Ltd.', 'Sun Pharmaceutical Industries Ltd.', "Dr. Reddy's Laboratories Ltd.",
        'Zydus Lifesciences Ltd.', 'Lupin Ltd.', 'Torrent Pharmaceuticals Ltd.',
        'Glenmark Pharmaceuticals Ltd.', 'Mankind Pharma Ltd.', 'Abbott India Ltd.',
        // Add more common companies or use the full list from your existing code
    ];

    const router = useRouter();

    // Load products from localStorage on component mount
    useEffect(() => {
        const storedProducts = localStorage.getItem('products');
        if (storedProducts) {
            try {
                const parsedProducts = JSON.parse(storedProducts);
                const productsWithFormattedData = parsedProducts.map(product => ({
                    ...product,
                    itemsPerPack: Number(product.itemsPerPack) || 1,
                    minStock: Number(product.minStock) || 0,
                    maxStock: Number(product.maxStock) || 0,
                    mrp: Number(product.mrp) || 0,
                    discount: Number(product.discount) || 0,
                    taxRate: Number(product.taxRate) || 0,
                    quantity: Number(product.quantity) || 0,
                    hsn: undefined,
                    schedule: undefined,
                    barcode: undefined,
                    batch: undefined,
                    expiry: undefined,
                })).filter(product => product.name);
                setProducts(productsWithFormattedData);
            } catch (error) {
                console.error("Error loading products from localStorage:", error);
                setProducts([]);
                toast.error("Error loading product data. Local storage might be corrupted.");
            }
        } else {
            setProducts([]);
        }
    }, []);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProductForm({ ...productForm, [name]: value });
    };

    // Validate form data
    const validateForm = () => {
        const { name, unit, itemsPerPack, mrp, taxRate, discount, minStock, maxStock } = productForm;

        if (!name.trim()) {
            toast.error('Product Name is required.'); return false;
        }
        if (!unit.trim()) {
            toast.error('Unit is required.'); return false;
        }

        const itemsPerPackNum = Number(itemsPerPack);
        if (itemsPerPack.trim() === '' || isNaN(itemsPerPackNum) || itemsPerPackNum <= 0) {
            toast.error('Valid "Items per Pack" is required and must be > 0.'); return false;
        }

        const mrpNum = Number(mrp);
        if (mrp.trim() === '' || isNaN(mrpNum) || mrpNum < 0) {
            toast.error('Valid "MRP" is required and must be >= 0.'); return false;
        }

        const taxRateNum = Number(taxRate);
        if (taxRate.trim() !== '' && (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100)) {
            toast.error('Valid "Tax Rate (%)" must be between 0 and 100 if entered.'); return false;
        }
        
        const discountNum = Number(discount);
        if (discount.trim() !== '' && (isNaN(discountNum) || discountNum < 0 || discountNum > 100)) {
            toast.error('Valid "Discount (%)" must be between 0 and 100 if entered.'); return false;
        }

        const minStockNum = Number(minStock);
         if (minStock.trim() !== '' && (isNaN(minStockNum) || minStockNum < 0)) {
             toast.error('Minimum Stock must be a non-negative number if entered.');
             return false;
         }

        const maxStockNum = Number(maxStock);
        if (maxStock.trim() !== '' && (isNaN(maxStockNum) || maxStockNum < 0)) {
            toast.error('Maximum Stock must be a non-negative number if entered.');
            return false;
        }
        if (minStock.trim() !== '' && maxStock.trim() !== '' && minStockNum > maxStockNum) {
            toast.error('Minimum Stock cannot be greater than Maximum Stock.');
            return false;
        }

        return true;
    };

    // Handle adding or updating a product
    const handleSaveProduct = () => {
        if (!validateForm()) return;

        const productData = {
            id: editingProduct ? editingProduct.id : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: productForm.name.trim(),
            unit: productForm.unit.trim(),
            category: productForm.category.trim(),
            company: productForm.company.trim(),
            itemsPerPack: Number(productForm.itemsPerPack),
            minStock: Number(productForm.minStock) || 0,
            maxStock: Number(productForm.maxStock) || 0,
            mrp: Number(productForm.mrp),
            discount: Number(productForm.discount) || 0,
            taxRate: Number(productForm.taxRate) || 0,
            quantity: editingProduct ? (editingProduct.quantity || 0) : 0,
        };

        let updatedProducts;
        if (editingProduct) {
            const nameConflict = products.some(p =>
                p.name.toLowerCase() === productData.name.toLowerCase() && p.id !== productData.id
            );
            if (nameConflict) {
                toast.error(`Another product with the name "${productData.name}" already exists.`);
                return;
            }
            updatedProducts = products.map(p =>
                p.id === productData.id ? { ...productData, quantity: p.quantity } : p
            );
            toast.success(`Product "${productData.name}" updated successfully!`);
        } else {
            if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase())) {
                toast.error(`Product with name "${productData.name}" already exists.`);
                return;
            }
            updatedProducts = [...products, productData];
            toast.success(`Product "${productData.name}" added successfully!`);
        }

        setProducts(updatedProducts);
        localStorage.setItem('products', JSON.stringify(updatedProducts));
        window.dispatchEvent(new Event('productsUpdated'));
        resetForm();
    };

    // Handle editing a product
    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name || '',
            unit: product.unit || '',
            category: product.category || '',
            company: product.company || '',
            itemsPerPack: String(product.itemsPerPack ?? '') || '',
            minStock: String(product.minStock ?? '') || '',
            maxStock: String(product.maxStock ?? '') || '',
            mrp: String(product.mrp ?? '') || '',
            discount: String(product.discount ?? '') || '',
            taxRate: String(product.taxRate ?? '') || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to show the form
    };

    // Handle deleting a product
    const handleDeleteProduct = (productId, productName) => {
        // Enhanced confirmation dialog
        toast(
            <div>
                <p className="font-semibold">Confirm Deletion</p>
                <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to delete product "{productName}"?
                    This action cannot be undone and will not adjust stock in past transactions.
                </p>
            </div>,
            {
                action: {
                    label: 'Delete',
                    onClick: () => {
                        const updatedProducts = products.filter(p => p.id !== productId);
                        setProducts(updatedProducts);
                        localStorage.setItem('products', JSON.stringify(updatedProducts));
                        window.dispatchEvent(new Event('productsUpdated'));
                        toast.success(`Product "${productName}" deleted.`);
                        if (editingProduct && editingProduct.id === productId) {
                            resetForm();
                        }
                    },
                },
                cancel: {
                    label: 'Cancel',
                    onClick: () => { /* Do nothing */ },
                },
                duration: 10000, // Keep toast longer for confirmation
            }
        );
    };
    

    // Reset the form and editing state
    const resetForm = () => {
        setProductForm({
            name: '', unit: '', category: '', company: '', itemsPerPack: '',
            minStock: '', maxStock: '', mrp: '', discount: '', taxRate: '',
        });
        setEditingProduct(null);
    };

    // Derived state for filtered products
    const currentFilteredProducts = products.filter(product => {
        const query = searchQuery.toLowerCase();
        return (
            (product.name && product.name.toLowerCase().includes(query)) ||
            (product.unit && product.unit.toLowerCase().includes(query)) ||
            (product.category && product.category.toLowerCase().includes(query)) ||
            (product.company && product.company.toLowerCase().includes(query))
        );
    });

    // Input field component for consistency
    const FormInput = ({ icon: Icon, name, placeholder, value, onChange, type = "text", list, required, min, max, step, className = "" }) => (
        <div className={`flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150 ${className}`}>
            {Icon && <Icon className="h-5 w-5 text-gray-400 mx-3 shrink-0" />}
            <input
                type={type}
                name={name}
                placeholder={placeholder + (required ? " (Required)" : "")}
                className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                value={value}
                onChange={onChange}
                list={list}
                required={required}
                min={min}
                max={max}
                step={step}
            />
        </div>
    );


    return (
        <> {/* Using React Fragment */}
            <Header />
            <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 antialiased text-gray-800">
                <div className="container mx-auto">
                    {/* Product Form Section */}
                    <div className="bg-white p-6 rounded-xl shadow-xl mb-8">
                        <div className="flex flex-wrap justify-between items-center mb-6 border-b border-gray-200 pb-4">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-700 flex items-center">
                                <Package className="mr-3 h-7 w-7 text-indigo-600" />
                                {editingProduct ? 'Edit Product' : 'Add New Product'}
                            </h1>
                            <Button 
                                onClick={() => router.push("/")} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-150 text-sm font-medium flex items-center"
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
                            <FormInput icon={Tag} name="name" placeholder="Product Name" value={productForm.name} onChange={handleInputChange} required />
                            <FormInput icon={Ruler} name="unit" placeholder="Unit (e.g., Pcs)" value={productForm.unit} onChange={handleInputChange} list="unit-suggestions" required />
                            <FormInput icon={List} name="category" placeholder="Category" value={productForm.category} onChange={handleInputChange} list="category-suggestions" />
                            <FormInput icon={Building2} name="company" placeholder="Company/Manufacturer" value={productForm.company} onChange={handleInputChange} list="company-suggestions" />
                            <FormInput icon={Boxes} name="itemsPerPack" placeholder="Items per Pack" type="number" min="1" value={productForm.itemsPerPack} onChange={handleInputChange} required />
                            <FormInput icon={DollarSign} name="mrp" placeholder="MRP (per Item)" type="number" min="0" step="0.01" value={productForm.mrp} onChange={handleInputChange} required />
                            <FormInput icon={ArrowDownCircle} name="minStock" placeholder="Min Stock (Items)" type="number" min="0" value={productForm.minStock} onChange={handleInputChange} />
                            <FormInput icon={ArrowUpCircle} name="maxStock" placeholder="Max Stock (Items)" type="number" min="0" value={productForm.maxStock} onChange={handleInputChange} />
                            <FormInput icon={Percent} name="discount" placeholder="Discount (%)" type="number" min="0" max="100" value={productForm.discount} onChange={handleInputChange} />
                            <FormInput icon={Scale} name="taxRate" placeholder="Tax Rate (%)" type="number" min="0" max="100" value={productForm.taxRate} onChange={handleInputChange} />
                        </div>

                        {/* Datalists for suggestions */}
                        <datalist id="unit-suggestions">
                            {predefinedUnits.map((unit, index) => <option key={`unit-${index}`} value={unit} />)}
                        </datalist>
                        <datalist id="category-suggestions">
                            {predefinedCategories.map((category, index) => <option key={`cat-${index}`} value={category} />)}
                        </datalist>
                        <datalist id="company-suggestions">
                            {predefinedCompanies.map((company, index) => <option key={`comp-${index}`} value={company} />)}
                        </datalist>

                        <div className="flex flex-wrap gap-3 mt-6">
                            <Button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg shadow hover:shadow-md transition-all duration-150 font-semibold flex items-center text-sm">
                                {editingProduct ? <Edit className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} 
                                {editingProduct ? 'Update Product' : 'Save Product'}
                            </Button>
                            {editingProduct && (
                                <Button onClick={resetForm} className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg shadow hover:shadow-md transition-all duration-150 font-semibold flex items-center text-sm">
                                    <X className="mr-2 h-4 w-4" /> Cancel Edit
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Product List Section */}
                    <div className="bg-white p-6 rounded-xl shadow-xl">
                        <div className="flex flex-wrap justify-between items-center mb-5 border-b border-gray-200 pb-4">
                            <h2 className="text-2xl font-bold text-gray-700 flex items-center">
                                <List className="mr-3 h-6 w-6 text-indigo-600" /> Product List
                            </h2>
                            <div className="relative mt-3 md:mt-0 w-full md:w-auto md:max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full table-auto">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs sm:text-sm text-gray-600 uppercase tracking-wider">
                                        {/* Adjusted headers for clarity and responsive padding */}
                                        <th className="px-4 py-3 font-semibold">Name</th>
                                        <th className="px-3 py-3 font-semibold">Unit</th>
                                        <th className="px-3 py-3 font-semibold hidden md:table-cell">Category</th>
                                        <th className="px-3 py-3 font-semibold hidden lg:table-cell">Company</th>
                                        <th className="px-3 py-3 font-semibold text-center">Items/Pack</th>
                                        <th className="px-3 py-3 font-semibold text-right hidden sm:table-cell">MRP</th>
                                        <th className="px-3 py-3 font-semibold text-center hidden lg:table-cell">Disc %</th>
                                        <th className="px-3 py-3 font-semibold text-center hidden lg:table-cell">Tax %</th>
                                        <th className="px-3 py-3 font-semibold text-right">Stock</th>
                                        <th className="px-4 py-3 font-semibold text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {currentFilteredProducts.length > 0 ? (
                                        currentFilteredProducts.map((product) => (
                                            <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-150 text-sm text-gray-700">
                                                <td className="px-4 py-3 font-medium whitespace-nowrap">{product.name}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{product.unit}</td>
                                                <td className="px-3 py-3 whitespace-nowrap hidden md:table-cell">{product.category || '-'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">{product.company || '-'}</td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">{product.itemsPerPack}</td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap hidden sm:table-cell">₹{Number(product.mrp).toFixed(2)}</td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap hidden lg:table-cell">{product.discount}%</td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap hidden lg:table-cell">{product.taxRate}%</td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap font-medium">{product.quantity}</td>
                                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                                    <div className="flex justify-center items-center space-x-2">
                                                        <Button variant="outline" size="icon" onClick={() => handleEditProduct(product)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 border-blue-300 hover:border-blue-500 p-1.5 rounded-md transition-all">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDeleteProduct(product.id, product.name)} className="text-red-600 hover:text-red-800 hover:bg-red-100 border-red-300 hover:border-red-500 p-1.5 rounded-md transition-all">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="10" className="px-4 py-8 text-center text-gray-500"> {/* Adjusted colSpan */}
                                                {searchQuery ? `No products found matching "${searchQuery}".` : "No products available. Add a new product to get started."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                         {currentFilteredProducts.length === 0 && products.length > 0 && !searchQuery && (
                            <p className="text-center text-gray-500 mt-4">No products match your current filter.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProductMasterPage;
