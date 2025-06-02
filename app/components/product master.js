// app/productmaster/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    IndianRupee, // Changed from DollarSign for Rupee icon
    Percent,
    Scale,
    X,
    Save, // Added Save icon
    ArrowDownUp, // Icon for sortable columns
    ChevronLeft, // Icon for pagination previous
    ChevronRight, // Icon for pagination next
    RefreshCcw // Icon for Clear Form
} from 'lucide-react';

const ProductMasterPage = () => {
    // Log component render
    console.log("ProductMasterPage: Component Rendering...");

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

    // State for Sorting
    const [sortColumn, setSortColumn] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

    // State for Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [productsPerPage] = useState(10); // Number of products per page

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
        console.log("ProductMasterPage useEffect: Loading products from localStorage...");
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
                    quantity: Number(product.quantity) || 0, // Ensure quantity is a number
                    // Remove transient or irrelevant fields if they somehow got saved
                    hsn: undefined,
                    schedule: undefined,
                    barcode: undefined,
                    batch: undefined, // Batch/Expiry are per purchase/sale, not master
                    expiry: undefined,
                })).filter(product => product.name); // Filter out any entries without a name

                console.log(`ProductMasterPage useEffect: Loaded and parsed ${productsWithFormattedData.length} products.`);
                setProducts(productsWithFormattedData);
            } catch (error) {
                console.error("ProductMasterPage useEffect: Error loading products from localStorage:", error);
                setProducts([]);
                toast.error("Error loading product data. Local storage might be corrupted.");
            }
        } else {
            console.log("ProductMasterPage useEffect: No products found in localStorage.");
            setProducts([]);
        }

         // Add event listener for product updates from other pages (e.g., Sales, Purchase)
         const handleProductsUpdated = () => {
              console.log("ProductMasterPage: 'productsUpdated' event received. Reloading products.");
              const updatedStoredProducts = localStorage.getItem('products');
              if (updatedStoredProducts) {
                  try {
                       const parsedProducts = JSON.parse(updatedStoredProducts);
                       const productsWithFormattedData = parsedProducts.map(product => ({
                           ...product,
                           itemsPerPack: Number(product.itemsPerPack) || 1,
                           minStock: Number(product.minStock) || 0,
                           maxStock: Number(product.maxStock) || 0,
                           mrp: Number(product.mrp) || 0,
                           discount: Number(product.discount) || 0,
                           taxRate: Number(product.taxRate) || 0,
                           quantity: Number(product.quantity) || 0,
                           hsn: undefined, schedule: undefined, barcode: undefined, batch: undefined, expiry: undefined,
                       })).filter(product => product.name);
                       setProducts(productsWithFormattedData);
                       console.log(`ProductMasterPage: Reloaded ${productsWithFormattedData.length} products after update event.`);
                  } catch (error) {
                       console.error("ProductMasterPage: Error reloading products after update event:", error);
                       toast.error("Error reloading product data after update.");
                  }
              } else {
                   setProducts([]);
                   console.log("ProductMasterPage: No products found after update event.");
              }
         };

         window.addEventListener('productsUpdated', handleProductsUpdated);

         // Clean up event listener
         return () => {
              console.log("ProductMasterPage useEffect: Cleaning up 'productsUpdated' event listener.");
              window.removeEventListener('productsUpdated', handleProductsUpdated);
         };

    }, []); // Empty dependency array ensures this runs only once on mount

    // Handle form input changes - Added more detailed logging
    const handleInputChange = (e) => {
        // e.persist(); // Potentially helps with synthetic event pooling issues, less common in modern React
        const { name, value } = e.target;
        console.log(`handleInputChange: Event received for name="${name}" with value="${value}"`);
        // console.log("handleInputChange: Event object:", e); // Log the entire event object - Can be noisy
        // console.log("handleInputChange: Event target:", e.target); // Log the event target element - Can be noisy

        setProductForm(prevForm => {
            console.log(`handleInputChange: Updating state for "${name}" from "${prevForm[name]}" to "${value}"`);
            const newForm = { ...prevForm, [name]: value };
            console.log("handleInputChange: New productForm state:", newForm);
            return newForm;
        });
    };

    // Validate form data
    const validateForm = () => {
        console.log("Validating form:", productForm);
        const { name, unit, itemsPerPack, mrp, taxRate, discount, minStock, maxStock } = productForm;

        if (!name.trim()) {
            toast.error('Product Name is required.'); console.log("Validation failed: Name empty."); return false;
        }
        if (!unit.trim()) {
            toast.error('Unit is required.'); console.log("Validation failed: Unit empty."); return false;
        }

        const itemsPerPackNum = Number(itemsPerPack);
        if (itemsPerPack.trim() === '' || isNaN(itemsPerPackNum) || itemsPerPackNum <= 0) {
            toast.error('Valid "Items per Pack" is required and must be > 0.'); console.log("Validation failed: Invalid Items per Pack."); return false;
        }

        const mrpNum = Number(mrp);
        if (mrp.trim() === '' || isNaN(mrpNum) || mrpNum < 0) {
            toast.error('Valid "MRP" is required and must be >= 0.'); console.log("Validation failed: Invalid MRP."); return false;
        }

        const taxRateNum = Number(taxRate);
        if (taxRate.trim() !== '' && (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100)) {
            toast.error('Valid "Tax Rate (%)" must be between 0 and 100 if entered.'); console.log("Validation failed: Invalid Tax Rate."); return false;
        }

        const discountNum = Number(discount);
        if (discount.trim() !== '' && (isNaN(discountNum) || discountNum < 0 || discountNum > 100)) {
            toast.error('Valid "Discount (%)" must be between 0 and 100 if entered.'); console.log("Validation failed: Invalid Discount."); return false;
        }

        const minStockNum = Number(minStock);
         if (minStock.trim() !== '' && (isNaN(minStockNum) || minStockNum < 0)) {
             toast.error('Minimum Stock must be a non-negative number if entered.'); console.log("Validation failed: Invalid Min Stock.");
             return false;
         }

        const maxStockNum = Number(maxStock);
        if (maxStock.trim() !== '' && (isNaN(maxStockNum) || maxStockNum < 0)) {
            toast.error('Maximum Stock must be a non-negative number if entered.'); console.log("Validation failed: Invalid Max Stock.");
            return false;
        }
        if (minStock.trim() !== '' && maxStock.trim() !== '' && minStockNum > maxStockNum) {
            toast.error('Minimum Stock cannot be greater than Maximum Stock.'); console.log("Validation failed: Min > Max Stock.");
            return false;
        }

        console.log("Form validation successful.");
        return true;
    };

    // Handle adding or updating a product
    const handleSaveProduct = () => {
        console.log("Attempting to save product...");
        if (!validateForm()) {
            console.log("Validation failed, save aborted.");
            return;
        }

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
            // Preserve existing quantity if editing, otherwise start at 0
            quantity: editingProduct ? (Number(editingProduct.quantity) || 0) : 0,
        };

        let updatedProducts;
        if (editingProduct) {
            console.log("Editing existing product:", editingProduct.id);
            const nameConflict = products.some(p =>
                p.name.toLowerCase() === productData.name.toLowerCase() && p.id !== productData.id
            );
            if (nameConflict) {
                toast.error(`Another product with the name "${productData.name}" already exists.`);
                console.log("Name conflict during edit.");
                return;
            }
            updatedProducts = products.map(p =>
                p.id === productData.id ? { ...productData, quantity: p.quantity } : p
            );
            toast.success(`Product "${productData.name}" updated successfully!`);
            console.log("Product updated:", productData);
        } else {
            console.log("Adding new product.");
            if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase())) {
                toast.error(`Product with name "${productData.name}" already exists.`);
                console.log("Name conflict during add.");
                return;
            }
            updatedProducts = [...products, productData];
            toast.success(`Product "${productData.name}" added successfully!`);
            console.log("New product added:", productData);
        }

        setProducts(updatedProducts);
        try {
            localStorage.setItem('products', JSON.stringify(updatedProducts));
            console.log("Products saved to localStorage.");
             // Dispatch event to notify other components that products data has changed
            window.dispatchEvent(new Event('productsUpdated'));
            console.log("'productsUpdated' event dispatched.");
        } catch (error) {
             console.error("Error saving products to localStorage:", error);
             toast.error("Error saving product data. Local storage might be full.");
        }

        resetForm();
        console.log("Form reset after save.");
    };

    // Handle editing a product
    const handleEditProduct = (product) => {
        console.log("Initiating edit for product:", product.name);
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
        console.log("Product form populated for editing.");
    };

    // Handle deleting a product
    const handleDeleteProduct = (productId, productName) => {
         console.log(`Attempting to delete product ID: ${productId}, Name: "${productName}"`);
        // Enhanced confirmation dialog using Sonner
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
                        console.log("User confirmed deletion.");
                        const updatedProducts = products.filter(p => p.id !== productId);
                        setProducts(updatedProducts);
                        try {
                            localStorage.setItem('products', JSON.stringify(updatedProducts));
                            console.log("Products saved to localStorage after deletion.");
                            window.dispatchEvent(new Event('productsUpdated')); // Dispatch event
                            console.log("'productsUpdated' event dispatched after deletion.");
                        } catch (error) {
                             console.error("Error saving products after deletion to localStorage:", error);
                             toast.error("Error saving product data after deletion.");
                        }
                        toast.success(`Product "${productName}" deleted.`);
                        console.log(`Product "${productName}" deleted successfully.`);
                        if (editingProduct && editingProduct.id === productId) {
                            resetForm();
                            console.log("Deleted product was being edited. Form reset.");
                        }
                    },
                },
                cancel: {
                    label: 'Cancel',
                    onClick: () => { console.log("Deletion cancelled by user."); /* Do nothing */ },
                },
                duration: 10000, // Keep toast longer for confirmation
            }
        );
    };

    // Reset the form and editing state
    const resetForm = useCallback(() => {
        console.log("Resetting product form.");
        setProductForm({
            name: '', unit: '', category: '', company: '', itemsPerPack: '',
            minStock: '', maxStock: '', mrp: '', discount: '', taxRate: '',
        });
        setEditingProduct(null);
        console.log("Product form reset.");
    }, []); // No dependencies, can be memoized

    // Handler for sorting column
    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page on sort
    };

    // Derived state for filtered and sorted products
    const currentFilteredAndSortedProducts = useMemo(() => {
        console.log("Filtering and sorting products based on query and sort state...");
        const query = searchQuery.toLowerCase();
        const filtered = products.filter(product => {
            const nameMatch = product.name && product.name.toLowerCase().includes(query);
            const unitMatch = product.unit && product.unit.toLowerCase().includes(query);
            const categoryMatch = product.category && product.category.toLowerCase().includes(query);
            const companyMatch = product.company && product.company.toLowerCase().includes(query);
            return nameMatch || unitMatch || categoryMatch || companyMatch;
        });

        // Apply sorting
        const sorted = [...filtered].sort((a, b) => {
            const aValue = a[sortColumn];
            const bValue = b[sortColumn];

            // Handle numeric comparisons
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            // Handle string comparisons
            if (aValue && bValue) {
                const comparison = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());
                return sortDirection === 'asc' ? comparison : -comparison;
            }
            // Fallback for null/undefined values or mixed types
            return 0;
        });

        console.log("Filtered and sorted products count:", sorted.length);
        return sorted;
    }, [products, searchQuery, sortColumn, sortDirection]);

    // Pagination logic
    const totalPages = Math.ceil(currentFilteredAndSortedProducts.length / productsPerPage);
    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentProducts = currentFilteredAndSortedProducts.slice(indexOfFirstProduct, indexOfLastProduct);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Get the current sort icon based on column and direction
    const getSortIcon = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? '▲' : '▼';
        }
        return '';
    };

    return (
        <> {/* Using React Fragment */}
            <Header />
            {/* Added fade-in class to the main container */}
            <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 antialiased text-gray-800 fade-in">
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
                            {/* Input fields rendered directly */}
                            <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Tag className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="name" // Still using key for consistency
                                    type="text"
                                    name="name"
                                    placeholder="Product Name (Required)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.name}
                                    onChange={handleInputChange}
                                    required
                                    list="product-suggestions" // Re-added list attribute
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Ruler className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="unit"
                                    type="text"
                                    name="unit"
                                    placeholder="Unit (e.g., Pcs) (Required)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.unit}
                                    onChange={handleInputChange}
                                    required
                                    list="unit-suggestions" // Re-added list attribute
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <List className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="category"
                                    type="text"
                                    name="category"
                                    placeholder="Category"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.category}
                                    onChange={handleInputChange}
                                     list="category-suggestions" // Re-added list attribute
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Building2 className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="company"
                                    type="text"
                                    name="company"
                                    placeholder="Company/Manufacturer"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.company}
                                    onChange={handleInputChange}
                                     list="company-suggestions" // Re-added list attribute
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Boxes className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="itemsPerPack"
                                    type="number"
                                    name="itemsPerPack"
                                    placeholder="Items per Pack (Required)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.itemsPerPack}
                                    onChange={handleInputChange}
                                    required
                                    min="1"
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <IndianRupee className="h-5 w-5 text-gray-400 mx-3 shrink-0" /> {/* Changed from DollarSign */}
                                <input
                                    key="mrp"
                                    type="number"
                                    name="mrp"
                                    placeholder="MRP (per Item) (Required)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.mrp}
                                    onChange={handleInputChange}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <ArrowDownCircle className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="minStock"
                                    type="number"
                                    name="minStock"
                                    placeholder="Min Stock (Items)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.minStock}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <ArrowUpCircle className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="maxStock"
                                    type="number"
                                    name="maxStock"
                                    placeholder="Max Stock (Items)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.maxStock}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Percent className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="discount"
                                    type="number"
                                    name="discount"
                                    placeholder="Discount (%)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.discount}
                                    onChange={handleInputChange}
                                    min="0"
                                    max="100"
                                />
                            </div>
                             <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-150">
                                <Scale className="h-5 w-5 text-gray-400 mx-3 shrink-0" />
                                <input
                                    key="taxRate"
                                    type="number"
                                    name="taxRate"
                                    placeholder="Tax Rate (%)"
                                    className="p-3 w-full focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                                    value={productForm.taxRate}
                                    onChange={handleInputChange}
                                    min="0"
                                    max="100"
                                />
                            </div>
                        </div>

                        {/* Datalists for suggestions */}
                        <datalist id="product-suggestions">
                             {products.map((product, index) => <option key={`prod-sugg-${index}`} value={product.name} />)}
                         </datalist>
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
                            {editingProduct ? (
                                <Button onClick={resetForm} className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg shadow hover:shadow-md transition-all duration-150 font-semibold flex items-center text-sm">
                                    <X className="mr-2 h-4 w-4" /> Cancel Edit
                                </Button>
                            ) : (
                                <Button onClick={resetForm} className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg shadow hover:shadow-md transition-all duration-150 font-semibold flex items-center text-sm">
                                    <RefreshCcw className="mr-2 h-4 w-4" /> Clear Form
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
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1); // Reset to first page on search
                                    }}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full table-auto">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs sm:text-sm text-gray-600 uppercase tracking-wider">
                                        <th className="px-4 py-3 font-semibold cursor-pointer" onClick={() => handleSort('name')}>
                                            Name {getSortIcon('name')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold cursor-pointer" onClick={() => handleSort('unit')}>
                                            Unit {getSortIcon('unit')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold hidden md:table-cell cursor-pointer" onClick={() => handleSort('category')}>
                                            Category {getSortIcon('category')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold hidden lg:table-cell cursor-pointer" onClick={() => handleSort('company')}>
                                            Company {getSortIcon('company')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold text-center cursor-pointer" onClick={() => handleSort('itemsPerPack')}>
                                            Items/Pack {getSortIcon('itemsPerPack')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold text-right hidden sm:table-cell cursor-pointer" onClick={() => handleSort('mrp')}>
                                            MRP {getSortIcon('mrp')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold text-center hidden lg:table-cell cursor-pointer" onClick={() => handleSort('discount')}>
                                            Disc % {getSortIcon('discount')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold text-center hidden lg:table-cell cursor-pointer" onClick={() => handleSort('taxRate')}>
                                            Tax % {getSortIcon('taxRate')}
                                        </th>
                                        <th className="px-3 py-3 font-semibold text-right cursor-pointer" onClick={() => handleSort('quantity')}>
                                            Stock {getSortIcon('quantity')}
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {currentProducts.length > 0 ? (
                                        currentProducts.map((product) => (
                                            // Added fade-in-item class to table rows
                                            <tr
                                                key={product.id}
                                                className={`hover:bg-slate-50 transition-colors duration-150 text-sm text-gray-700 fade-in-item
                                                ${product.quantity <= product.minStock && product.minStock > 0 ? 'bg-red-50 text-red-700' : ''}
                                                ${product.quantity >= product.maxStock && product.maxStock > 0 ? 'bg-amber-50 text-amber-700' : ''}
                                                `}
                                            >
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

                        {/* Pagination Controls */}
                        {currentFilteredAndSortedProducts.length > productsPerPage && (
                            <nav className="flex justify-center items-center gap-2 pt-4" aria-label="Pagination">
                                <Button
                                    onClick={() => paginate(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg"
                                >
                                    <ChevronLeft className="h-5 w-5" /> Previous
                                </Button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <Button
                                        key={page}
                                        onClick={() => paginate(page)}
                                        className={`px-4 py-2 rounded-lg ${currentPage === page ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                    >
                                        {page}
                                    </Button>
                                ))}
                                <Button
                                    onClick={() => paginate(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg"
                                >
                                    Next <ChevronRight className="h-5 w-5" />
                                </Button>
                            </nav>
                        )}

                         {currentFilteredAndSortedProducts.length === 0 && products.length > 0 && searchQuery && (
                            <p className="text-center text-gray-500 mt-4">No products match your current search query.</p>
                        )}
                        {currentFilteredAndSortedProducts.length === 0 && products.length > 0 && !searchQuery && (
                            <p className="text-center text-gray-500 mt-4">No products available after filtering/sorting.</p>
                        )}
                    </div>
                </div>
            </div>
             <style jsx>{`
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                 .fade-in-item {
                    opacity: 0;
                    animation: fadeInItem 0.5s ease-out forwards;
                 }
                @keyframes fadeInItem {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default ProductMasterPage;