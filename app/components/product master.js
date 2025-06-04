// app/components/productmaster
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

// Import Firebase services
import { db, auth, initializeFirebaseAndAuth } from '../lib/firebase'; // Adjust path as needed
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
        salePrice: '', // NEW: Added salePrice field
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

    // Firebase specific states
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true); // Added loading state for Firebase data
    const [error, setError] = useState(null); // Added error state for Firebase data

    // Get the app ID, with a fallback for environments where it might not be defined
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


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

    // --- Initial Firebase Setup and Authentication Listener ---
    useEffect(() => {
        const setupFirebase = async () => {
            await initializeFirebaseAndAuth(); // Initialize Firebase and sign in

            // Set up auth state observer
            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("ProductMasterPage: Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    console.log("ProductMasterPage: Auth state changed, no user (anonymous or logged out).");
                }
                setIsAuthReady(true); // Auth state has been determined (even if null)
            });

            return () => {
                unsubscribeAuth(); // Clean up auth listener on unmount
            };
        };

        setupFirebase();
    }, []); // Run only once on component mount


    // Load products from Firestore on component mount and listen for real-time updates
    useEffect(() => {
        if (!isAuthReady || !userId) return; // Wait for authentication to be ready

        console.log("ProductMasterPage Firestore: Setting up products snapshot listener...");
        // Use __app_id and userId for collection path
        const productsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
        const unsubscribe = onSnapshot(productsCollectionRef, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedProducts = productsData.map(product => ({
                ...product,
                itemsPerPack: Number(product.itemsPerPack) || 1,
                minStock: Number(product.minStock) || 0,
                maxStock: Number(product.maxStock) || 0,
                mrp: Number(product.mrp) || 0,
                salePrice: Number(product.salePrice) || 0,
                discount: Number(product.discount) || 0,
                taxRate: Number(product.taxRate) || 0,
                quantity: Number(product.quantity) || 0, // Ensure quantity is a number
            })).filter(product => product.name); // Filter out any entries without a name

            setProducts(processedProducts);
            setLoading(false); // Set loading to false once products are loaded
            console.log(`ProductMasterPage Firestore: Loaded and parsed ${processedProducts.length} products.`);
        }, (error) => {
            console.error("ProductMasterPage Firestore Error:", error);
            setError("Error loading product data from cloud.");
            setLoading(false);
            toast.error("Error loading product data.");
        });

        // Clean up listener on component unmount
        return () => {
            console.log("ProductMasterPage Firestore: Cleaning up products snapshot listener.");
            unsubscribe();
        };
    }, [isAuthReady, userId, appId]); // Re-run if auth state or user or appId changes


    // Handle form input changes - Added more detailed logging
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        console.log(`handleInputChange: Event received for name="${name}" with value="${value}"`);

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
        const { name, unit, itemsPerPack, mrp, salePrice, taxRate, discount, minStock, maxStock } = productForm;

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

        // NEW: Validate salePrice
        const salePriceNum = Number(salePrice);
        if (salePrice.trim() !== '' && (isNaN(salePriceNum) || salePriceNum < 0)) {
            toast.error('Valid "Sale Price" must be a non-negative number if entered.'); console.log("Validation failed: Invalid Sale Price."); return false;
        }
        if (salePrice.trim() !== '' && mrp.trim() !== '' && salePriceNum > mrpNum) {
            toast.error('Sale Price cannot be greater than MRP.'); console.log("Validation failed: Sale Price > MRP."); return false;
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

    // Handle adding or updating a product (Firestore integration)
    const handleSaveProduct = async () => {
        console.log("Attempting to save product...");
        if (!userId) {
            toast.error("User not authenticated. Cannot save product.");
            return;
        }
        if (!validateForm()) {
            console.log("Validation failed, save aborted.");
            return;
        }

        const productData = {
            name: productForm.name.trim(),
            unit: productForm.unit.trim(),
            category: productForm.category.trim(),
            company: productForm.company.trim(),
            itemsPerPack: Number(productForm.itemsPerPack),
            minStock: Number(productForm.minStock) || 0,
            maxStock: Number(productForm.maxStock) || 0,
            mrp: Number(productForm.mrp),
            salePrice: Number(productForm.salePrice) || 0,
            discount: Number(productForm.discount) || 0,
            taxRate: Number(productForm.taxRate) || 0,
            // Quantity is managed dynamically based on purchases/sales, not directly in master
            quantity: editingProduct ? (Number(editingProduct.quantity) || 0) : 0,
        };

        try {
            const productsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
            if (editingProduct) {
                console.log("Editing existing product:", editingProduct.id);
                const nameConflict = products.some(p =>
                    p.name.toLowerCase() === productData.name.toLowerCase() && p.id !== editingProduct.id
                );
                if (nameConflict) {
                    toast.error(`Another product with the name "${productData.name}" already exists.`);
                    console.log("Name conflict during edit.");
                    return;
                }
                await updateDoc(doc(productsCollectionRef, editingProduct.id), productData);
                toast.success(`Product "${productData.name}" updated successfully!`);
                console.log("Product updated in Firestore:", productData);
            } else {
                console.log("Adding new product.");
                if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase())) {
                    toast.error(`Product with name "${productData.name}" already exists.`);
                    console.log("Name conflict during add.");
                    return;
                }
                await addDoc(productsCollectionRef, productData);
                toast.success(`Product "${productData.name}" added successfully!`);
                console.log("New product added to Firestore:", productData);
            }
            // Dispatch event to notify other components that products data has changed
            window.dispatchEvent(new Event('productsUpdated'));
            console.log("'productsUpdated' event dispatched.");
        } catch (error) {
            console.error("Error saving product to Firestore:", error);
            toast.error("Failed to save product data to cloud.");
        }

        handleClearForm(); // Clear the form after saving
    };

    // Handle deleting a product (Firestore integration)
    const handleDeleteProduct = async (id, name) => {
        console.log(`Attempting to delete product with ID: ${id}, Name: ${name}`);
        if (!userId) {
            toast.error("User not authenticated. Cannot delete product.");
            return;
        }

        // Using a toast for confirmation instead of window.confirm
        toast.info(`Deleting "${name}"...`, { duration: 1000 }); // Provide immediate feedback

        try {
            const productsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
            await deleteDoc(doc(productsCollectionRef, id));
            toast.success(`Product "${name}" deleted successfully.`);
            window.dispatchEvent(new Event('productsUpdated'));
        } catch (error) {
            console.error("Error deleting product from Firestore:", error);
            toast.error("Failed to delete product from cloud.");
        }
    };

    // Handle editing a product
    const handleEditProduct = (product) => {
        console.log("Setting product for edit:", product);
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            unit: product.unit,
            category: product.category,
            company: product.company,
            itemsPerPack: product.itemsPerPack,
            minStock: product.minStock,
            maxStock: product.maxStock,
            mrp: product.mrp,
            salePrice: product.salePrice, // Load salePrice for editing
            discount: product.discount,
            taxRate: product.taxRate,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top of the form
    };

    // Clear form and reset editing state
    const handleClearForm = () => {
        console.log("Clearing form and resetting editing state.");
        setProductForm({
            name: '',
            unit: '',
            category: '',
            company: '',
            itemsPerPack: '',
            minStock: '',
            maxStock: '',
            mrp: '',
            salePrice: '', // Clear salePrice
            discount: '',
            taxRate: '',
        });
        setEditingProduct(null);
    };

    // Handle sorting columns
    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page on sort
        console.log(`Sorting by column: ${column}, direction: ${sortDirection}`);
    };

    // Memoized filtered and sorted products for display
    const filteredAndSortedProducts = useMemo(() => {
        console.log("useMemo: Filtering and sorting products...");
        let filtered = products.filter(product =>
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.company.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (sortColumn) {
            filtered.sort((a, b) => {
                const aValue = typeof a[sortColumn] === 'string' ? a[sortColumn].toLowerCase() : a[sortColumn];
                const bValue = typeof b[sortColumn] === 'string' ? b[sortColumn].toLowerCase() : b[sortColumn];

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        console.log(`useMemo: Found ${filtered.length} filtered and sorted products.`);
        return filtered;
    }, [products, searchQuery, sortColumn, sortDirection]);

    // Pagination logic
    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentFilteredAndSortedProducts = useMemo(() => {
        console.log("useMemo: Slicing products for current page.");
        return filteredAndSortedProducts.slice(indexOfFirstProduct, indexOfLastProduct);
    }, [filteredAndSortedProducts, indexOfFirstProduct, indexOfLastProduct]);

    const totalPages = Math.ceil(filteredAndSortedProducts.length / productsPerPage);

    const paginate = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
            console.log(`Paginating to page: ${pageNumber}`);
        }
    };

    // Display loading or error message
    if (loading || !isAuthReady) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="loader"></div>
                <p className="ml-4 text-gray-700">Loading data and authenticating...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen text-red-600">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-100 rounded-lg shadow-inner fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">Product Master</h2>
                    <Button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                        Go to Dashboard
                    </Button>
                </div>

                {/* Display User ID (MANDATORY for multi-user apps) */}
                {userId && (
                    <div className="mb-4 p-3 bg-gray-200 rounded-md text-sm text-gray-700">
                        <span className="font-semibold">Current User ID:</span> {userId}
                    </div>
                )}

                {/* Product Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Product Name */}
                        <div className="mb-4">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                <Tag className="inline-block h-4 w-4 mr-1 text-gray-500" />Product Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={productForm.name}
                                onChange={handleInputChange}
                                placeholder="e.g., Paracetamol 500mg"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        {/* Unit */}
                        <div className="mb-4">
                            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                                <Ruler className="inline-block h-4 w-4 mr-1 text-gray-500" />Unit
                            </label>
                            <input
                                type="text"
                                id="unit"
                                name="unit"
                                value={productForm.unit}
                                onChange={handleInputChange}
                                placeholder="e.g., Pcs, Bottle, Strip"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                list="predefinedUnits"
                            />
                            <datalist id="predefinedUnits">
                                {predefinedUnits.map((unit, index) => (
                                    <option key={index} value={unit} />
                                ))}
                            </datalist>
                        </div>

                        {/* Category */}
                        <div className="mb-4">
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                                <List className="inline-block h-4 w-4 mr-1 text-gray-500" />Category
                            </label>
                            <input
                                type="text"
                                id="category"
                                name="category"
                                value={productForm.category}
                                onChange={handleInputChange}
                                placeholder="e.g., Tablet, Syrup, Injection"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                list="predefinedCategories"
                            />
                            <datalist id="predefinedCategories">
                                {predefinedCategories.map((category, index) => (
                                    <option key={index} value={category} />
                                ))}
                            </datalist>
                        </div>

                        {/* Company */}
                        <div className="mb-4">
                            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                                <Building2 className="inline-block h-4 w-4 mr-1 text-gray-500" />Company
                            </label>
                            <input
                                type="text"
                                id="company"
                                name="company"
                                value={productForm.company}
                                onChange={handleInputChange}
                                placeholder="e.g., Cipla, Sun Pharma"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                list="predefinedCompanies"
                            />
                            <datalist id="predefinedCompanies">
                                {predefinedCompanies.map((company, index) => (
                                    <option key={index} value={company} />
                                ))}
                            </datalist>
                        </div>

                        {/* Items per Pack */}
                        <div className="mb-4">
                            <label htmlFor="itemsPerPack" className="block text-sm font-medium text-gray-700 mb-1">
                                <Boxes className="inline-block h-4 w-4 mr-1 text-gray-500" />Items per Pack
                            </label>
                            <input
                                type="number"
                                id="itemsPerPack"
                                name="itemsPerPack"
                                value={productForm.itemsPerPack}
                                onChange={handleInputChange}
                                placeholder="e.g., 10 (for a strip of 10 tablets)"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                min="1"
                            />
                        </div>

                        {/* Minimum Stock */}
                        <div className="mb-4">
                            <label htmlFor="minStock" className="block text-sm font-medium text-gray-700 mb-1">
                                <ArrowDownCircle className="inline-block h-4 w-4 mr-1 text-gray-500" />Minimum Stock (Items)
                            </label>
                            <input
                                type="number"
                                id="minStock"
                                name="minStock"
                                value={productForm.minStock}
                                onChange={handleInputChange}
                                placeholder="e.g., 50 (items)"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                min="0"
                            />
                             <p className="mt-1 text-xs text-gray-500">
                                An alert will be triggered if stock falls below this.
                            </p>
                        </div>

                        {/* Maximum Stock */}
                        <div className="mb-4">
                            <label htmlFor="maxStock" className="block text-sm font-medium text-gray-700 mb-1">
                                <ArrowUpCircle className="inline-block h-4 w-4 mr-1 text-gray-500" />Maximum Stock (Items)
                            </label>
                            <input
                                type="number"
                                id="maxStock"
                                name="maxStock"
                                value={productForm.maxStock}
                                onChange={handleInputChange}
                                placeholder="e.g., 500 (items)"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                min="0"
                            />
                             <p className="mt-1 text-xs text-gray-500">
                                Helps in reordering and maintaining optimal inventory.
                            </p>
                        </div>

                        {/* MRP */}
                        <div className="mb-4">
                            <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 mb-1">
                                <IndianRupee className="inline-block h-4 w-4 mr-1 text-gray-500" />MRP (Max. Retail Price) / Pack
                            </label>
                            <input
                                type="number"
                                id="mrp"
                                name="mrp"
                                value={productForm.mrp}
                                onChange={handleInputChange}
                                placeholder="e.g., 99.99"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                aria-describedby="mrp-help"
                            />
                            <p id="mrp-help" className="mt-1 text-xs text-gray-500">
                                The Maximum Retail Price of one pack/unit.
                            </p>
                        </div>

                        {/* NEW: Sale Price input field */}
                        <div className="mb-4">
                            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700 mb-1">
                                <IndianRupee className="inline-block h-4 w-4 mr-1 text-gray-500" />Sale Price / Pack
                            </label>
                            <input
                                type="number"
                                id="salePrice"
                                name="salePrice"
                                value={productForm.salePrice}
                                onChange={handleInputChange}
                                placeholder="e.g., 89.99"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                aria-describedby="salePrice-help"
                            />
                            <p id="salePrice-help" className="mt-1 text-xs text-gray-500">
                                The default selling price for one pack/unit. Leave empty if same as MRP.
                            </p>
                        </div>

                        {/* Discount */}
                        <div className="mb-4">
                            <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">
                                <Percent className="inline-block h-4 w-4 mr-1 text-gray-500" />Discount (%)
                            </label>
                            <input
                                type="number"
                                id="discount"
                                name="discount"
                                value={productForm.discount}
                                onChange={handleInputChange}
                                placeholder="e.g., 10 (for 10% discount)"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                        </div>

                        {/* Tax Rate */}
                        <div className="mb-4">
                            <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">
                                <Scale className="inline-block h-4 w-4 mr-1 text-gray-500" />Tax Rate (%)
                            </label>
                            <input
                                type="number"
                                id="taxRate"
                                name="taxRate"
                                value={productForm.taxRate}
                                onChange={handleInputChange}
                                placeholder="e.g., 18 (for 18% GST)"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-6 flex justify-end space-x-3">
                        <Button
                            onClick={handleClearForm}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" /> Clear Form
                        </Button>
                        <Button
                            onClick={handleSaveProduct}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <Save className="mr-2 h-4 w-4" /> {editingProduct ? 'Update Product' : 'Add Product'}
                        </Button>
                    </div>
                </div>

                {/* Product List */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-semibold text-gray-700">Product List</h3>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm w-full md:w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('name')}
                                    >
                                        Product Name
                                        {sortColumn === 'name' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('unit')}
                                    >
                                        Unit
                                        {sortColumn === 'unit' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('category')}
                                    >
                                        Category
                                        {sortColumn === 'category' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('company')}
                                    >
                                        Company
                                        {sortColumn === 'company' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('itemsPerPack')}
                                    >
                                        Items/Pack
                                        {sortColumn === 'itemsPerPack' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('quantity')}
                                    >
                                        Current Stock (Items)
                                        {sortColumn === 'quantity' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('mrp')}
                                    >
                                        Current Master MRP/Pack
                                        {sortColumn === 'mrp' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    {/* NEW: Sale Price table header */}
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('salePrice')}
                                    >
                                        Default Sale Price/Pack
                                        {sortColumn === 'salePrice' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('discount')}
                                    >
                                        Discount (%)
                                        {sortColumn === 'discount' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('taxRate')}
                                    >
                                        Tax Rate (%)
                                        {sortColumn === 'taxRate' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th scope="col" className="relative px-3 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentFilteredAndSortedProducts.length > 0 ? (
                                    currentFilteredAndSortedProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-100 transition duration-100 ease-in-out">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.unit}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.category}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.company}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.itemsPerPack}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.quantity}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(product.mrp).toFixed(2)}</td>
                                            {/* NEW: Sale Price table data */}
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                {product.salePrice > 0 ? `₹${Number(product.salePrice).toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{Number(product.discount).toFixed(2)}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{Number(product.taxRate).toFixed(2)}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleEditProduct(product)}
                                                        className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors duration-200"
                                                        title="Edit Product"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDeleteProduct(product.id, product.name)}
                                                        className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-colors duration-200"
                                                        title="Delete Product"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="11" className="px-3 py-4 text-center text-sm text-gray-500">
                                            {searchQuery ? "No products match your search." : "No products added yet."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex justify-between items-center">
                        <Button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <span className="text-sm text-gray-700">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>

                    {currentFilteredAndSortedProducts.length === 0 && products.length > 0 && searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No products match your current search query.</p>
                    )}
                    {currentFilteredAndSortedProducts.length === 0 && products.length > 0 && !searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No products available after filtering/sorting.</p>
                    )}
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
                /* Loader styles */
                .loader {
                    border: 4px solid #f3f3f3; /* Light grey */
                    border-top: 4px solid #3498db; /* Blue */
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default ProductMasterPage;
