// app/sales/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '../components/button';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { toast } from 'sonner';
import {
    Trash2, Eye, Plus, X, Edit, Save, Share2, Printer, Search, RefreshCcw, AlertTriangle,
    ChevronDown, ChevronUp, ArrowDownUp, ChevronLeft, ChevronRight // Added missing icons for sorting and pagination
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
        const dayInt = parseInt(day, 10);
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        // Month is 0-indexed in JavaScript Date object
        const date = new Date(yearInt, monthInt - 1, dayInt);
        // Check if the parsed date is valid and matches the input components
        if (date.getFullYear() === yearInt && date.getMonth() === monthInt - 1 && date.getDate() === dayInt) {
            return date;
        }
    }
    console.warn(`Invalid date string for parsing: ${dateString}`);
    return null;
}

// Helper function to parse MM-YYYY string to Date (for expiry)
function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [month, year] = dateString.split('-');
    if (month && year && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        // For expiry, set to the last day of the month for accurate comparison
        const date = new Date(yearInt, monthInt, 0); // Day 0 of next month gives last day of current month
        if (date.getFullYear() === yearInt && date.getMonth() === monthInt - 1) { // Check if month is correct
            return date;
        }
    }
    console.warn(`Invalid month-year date string for parsing: ${dateString}`);
    return null;
}

const SalesPage = () => {
    const [sales, setSales] = useState([]);
    const [currentSale, setCurrentSale] = useState({
        id: null,
        customerName: '',
        saleDate: formatDate(new Date()),
        items: [],
        subTotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        paidAmount: '',
        balanceAmount: 0,
        paymentMethod: 'Cash',
        notes: '',
    });
    const [products, setProducts] = useState([]); // All products from master
    const [purchaseBills, setPurchaseBills] = useState([]); // All purchase bills
    const [salesBills, setSalesBills] = useState([]); // All sales bills (for stock calculation)

    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [currentSaleItem, setCurrentSaleItem] = useState({
        productId: '',
        productName: '',
        unit: '',
        category: '',
        batch: '',
        expiry: '',
        quantity: '',
        mrp: '',
        salePrice: '',
        discount: '',
        taxRate: '',
        itemSubtotal: 0,
        itemDiscountAmount: 0,
        itemTaxAmount: 0,
        itemTotal: 0,
        hsn: '',
        schedule: '',
        barcode: '',
    });
    const [editingSaleId, setEditingSaleId] = useState(null);
    const [expandedSaleId, setExpandedSaleId] = useState(null);
    const [isProductListVisible, setIsProductListVisible] = useState(false);
    const productSearchRef = useRef(null);
    const router = useRouter();

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingSale, setViewingSale] = useState(null); // Changed to null
    const viewModalRef = useRef(null); // Ref for the view modal content

    // State for Sorting
    const [sortColumn, setSortColumn] = useState('saleDate');
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

    // State for Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [salesPerPage] = useState(10); // Number of sales per page

    // Refs for latest state in useCallback functions
    const productsRef = useRef(products);
    const purchaseBillsRef = useRef(purchaseBills);
    const salesBillsRef = useRef(salesBills);

    useEffect(() => { productsRef.current = products; }, [products]);
    useEffect(() => { purchaseBillsRef.current = purchaseBills; }, [purchaseBills]);
    useEffect(() => { salesBillsRef.current = salesBills; }, [salesBills]);

    // Function to load products from localStorage
    const loadProductsData = useCallback(() => {
        try {
            const storedProducts = localStorage.getItem('products');
            const parsedProducts = storedProducts ? JSON.parse(storedProducts) : [];
            const processedProducts = parsedProducts.map(p => ({
                ...p,
                mrp: Number(p.mrp) || 0,
                salePrice: Number(p.salePrice) || 0,
                quantity: Number(p.quantity) || 0, // This master quantity is less relevant now for dynamic stock
            }));
            setProducts(processedProducts);
        } catch (error) {
            console.error("Error loading products:", error);
            toast.error("Failed to load product data.");
            setProducts([]);
        }
    }, []);

    // Function to load purchase bills from localStorage
    const loadPurchaseBillsData = useCallback(() => {
        try {
            const storedBills = localStorage.getItem('purchaseBills');
            const bills = storedBills ? JSON.parse(storedBills) : [];
            const processedBills = bills.map(bill => ({
                ...bill,
                date: bill.date || '',
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    ptr: Number(item.ptr) || 0,
                    mrp: Number(item.mrp) || 0,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    totalItemAmount: Number(item.totalItemAmount) || 0,
                })),
                totalAmount: Number(bill.totalAmount) || 0,
            }));
            setPurchaseBills(processedBills);
        } catch (error) {
            console.error("Error loading purchase bills:", error);
            toast.error("Failed to load purchase bills.");
            setPurchaseBills([]);
        }
    }, []);

    // Function to load sales bills from localStorage
    const loadSalesBillsData = useCallback(() => {
        try {
            const storedBills = localStorage.getItem('sales'); // Note: Sales bills are stored under 'sales' key
            const bills = storedBills ? JSON.parse(storedBills) : [];
            const processedBills = bills.map(bill => ({
                ...bill,
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0, // Quantity sold in sales
                    salePrice: Number(item.salePrice) || 0,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    itemTotal: Number(item.itemTotal) || 0,
                }))
            }));
            setSalesBills(processedBills);
        } catch (error) {
            console.error("Error loading sales bills:", error);
            toast.error("Failed to load sales bills.");
            setSalesBills([]);
        }
    }, []);

    // Function to calculate stock by batch for a product (using refs for latest data)
    const getStockByBatch = useCallback((productName) => {
        const batchMap = new Map();

        // Add quantities from purchase bills
        purchaseBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product.toLowerCase() === productName.toLowerCase()) {
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, (batchMap.get(key) || 0) + Number(item.quantity));
                }
            });
        });

        // Subtract quantities from sales bills
        salesBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.productName.toLowerCase() === productName.toLowerCase()) {
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, Math.max(0, (batchMap.get(key) || 0) - Number(item.quantity)));
                }
            });
        });

        return Array.from(batchMap.entries()).map(([key, quantity]) => {
            const [batch, expiry] = key.split('_');
            return { batch, expiry, quantity };
        }).filter(batch => batch.quantity > 0).sort((a, b) => {
            const dateA = parseMonthYearDate(a.expiry); // Use parseMonthYearDate for expiry
            const dateB = parseMonthYearDate(b.expiry);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA.getTime() - dateB.getTime();
        });
    }, []); // No direct state dependencies, uses refs

    // Helper function to calculate total stock for a product, for display
    const calculateTotalStockForProduct = useCallback((productName) => {
        const batchStocks = getStockByBatch(productName);
        return batchStocks.reduce((sum, batch) => sum + batch.quantity, 0);
    }, [getStockByBatch]);

    // Load initial data and set up listeners
    useEffect(() => {
        loadProductsData();
        loadPurchaseBillsData();
        loadSalesBillsData();

        const handleDataUpdated = () => {
            console.log("SalesPage: Data update event received. Reloading all data.");
            loadProductsData();
            loadPurchaseBillsData();
            loadSalesBillsData();
        };

        // Listen for custom events dispatched by other pages (e.g., PurchasePage)
        window.addEventListener("productsUpdated", handleDataUpdated);
        window.addEventListener("purchaseBillsUpdated", handleDataUpdated);
        window.addEventListener("salesUpdated", handleDataUpdated); // Listen for sales updates from this page itself too

        return () => {
            window.removeEventListener("productsUpdated", handleDataUpdated);
            window.removeEventListener("purchaseBillsUpdated", handleDataUpdated);
            window.removeEventListener("salesUpdated", handleDataUpdated);
        };
    }, [loadProductsData, loadPurchaseBillsData, loadSalesBillsData]);


    // Filter products based on search query and update stock display
    useEffect(() => {
        if (searchQuery) {
            const filtered = products.filter(product =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(product => ({
                ...product,
                calculatedCurrentStock: calculateTotalStockForProduct(product.name)
            }));
            setFilteredProducts(filtered);
            setIsProductListVisible(true);
        } else {
            setFilteredProducts(products.map(product => ({
                ...product,
                calculatedCurrentStock: calculateTotalStockForProduct(product.name)
            })));
            setIsProductListVisible(false); // Hide if search is empty
        }
    }, [searchQuery, products, calculateTotalStockForProduct]);

    // Calculate item total whenever currentSaleItem changes
    useEffect(() => {
        const quantity = Number(currentSaleItem.quantity) || 0;
        const salePrice = Number(currentSaleItem.salePrice) || 0;
        const discount = Number(currentSaleItem.discount) || 0;
        const taxRate = Number(currentSaleItem.taxRate) || 0;

        const itemSubtotal = quantity * salePrice;
        const itemDiscountAmount = itemSubtotal * (discount / 100);
        const itemAmountAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = itemAmountAfterDiscount * (taxRate / 100);
        const itemTotal = itemAmountAfterDiscount + itemTaxAmount;

        setCurrentSaleItem(prev => ({
            ...prev,
            itemSubtotal: itemSubtotal,
            itemDiscountAmount: itemDiscountAmount,
            itemTaxAmount: itemTaxAmount,
            itemTotal: itemTotal,
        }));
    }, [currentSaleItem.quantity, currentSaleItem.salePrice, currentSaleItem.discount, currentSaleItem.taxRate]);

    // Calculate grand totals whenever sales items change
    useEffect(() => {
        const newSubTotal = currentSale.items.reduce((sum, item) => sum + item.itemSubtotal, 0);
        const newTotalDiscount = currentSale.items.reduce((sum, item) => sum + item.itemDiscountAmount, 0);
        const newTotalTax = currentSale.items.reduce((sum, item) => sum + item.itemTaxAmount, 0);
        const newGrandTotal = currentSale.items.reduce((sum, item) => sum + item.itemTotal, 0);

        const paidAmount = Number(currentSale.paidAmount) || 0;
        const balanceAmount = newGrandTotal - paidAmount;

        setCurrentSale(prev => ({
            ...prev,
            subTotal: newSubTotal,
            totalDiscount: newTotalDiscount,
            totalTax: newTotalTax,
            grandTotal: newGrandTotal,
            balanceAmount: balanceAmount,
        }));
    }, [currentSale.items, currentSale.paidAmount]);

    // Handle form input changes for current sale
    const handleSaleChange = (e) => {
        const { name, value } = e.target;
        setCurrentSale(prev => ({ ...prev, [name]: value }));
    };

    // Handle input changes for current sale item
    const handleCurrentSaleItemChange = (e) => {
        const { name, value } = e.target;
        setCurrentSaleItem(prev => ({ ...prev, [name]: value }));
    };

    // When a product is selected from the search results
    const handleProductSelect = (product) => {
        // Find if a product with the same ID and batch exists in the current sale items
        const existingItemIndex = currentSale.items.findIndex(
            (item) => item.productId === product.id && item.batch === currentSaleItem.batch
        );

        if (existingItemIndex !== -1) {
            toast.warning(`Product "${product.name}" with Batch "${currentSaleItem.batch}" already exists in the current sale. Edit its quantity directly.`);
            setSearchQuery(''); // Clear search to hide product list
            setIsProductListVisible(false);
            return;
        }

        // Find the latest batch and expiry for the selected product from purchase bills
        let latestBatch = '';
        let latestExpiry = '';
        let latestPurchaseDate = 0; // To track the most recent purchase

        purchaseBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                // Match by product ID or name, and ensure it's a valid purchase item
                if (item.id === product.id || item.product.toLowerCase() === product.name.toLowerCase()) {
                    const billDateTime = parseDate(bill.date)?.getTime() || 0;
                    if (billDateTime > latestPurchaseDate) {
                        latestPurchaseDate = billDateTime;
                        latestBatch = item.batch || '';
                        latestExpiry = item.expiry || '';
                    }
                }
            });
        });


        // Initialize currentSaleItem with selected product details
        setCurrentSaleItem({
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            category: product.category,
            batch: latestBatch, // Auto-filled batch
            expiry: latestExpiry, // Auto-filled expiry
            quantity: 1, // Default to 1
            mrp: Number(product.mrp) || 0,
            salePrice: Number(product.salePrice) || Number(product.mrp) || 0, // Prefer salePrice, fallback to MRP
            discount: Number(product.discount) || 0,
            taxRate: Number(product.taxRate) || 0,
            itemSubtotal: 0, // Will be calculated by useEffect
            itemDiscountAmount: 0, // Will be calculated by useEffect
            itemTaxAmount: 0, // Will be calculated by useEffect
            itemTotal: 0, // Will be calculated by useEffect
            hsn: product.hsn || '',
            schedule: product.schedule || '',
            barcode: product.barcode || '',
        });
        setSearchQuery(product.name); // Keep selected product name in search bar
        setIsProductListVisible(false); // Hide the product list
    };

    // Add item to current sale
    const handleAddItemToSale = () => {
        const { productName, quantity, batch, expiry, salePrice } = currentSaleItem;

        if (!productName || !quantity || Number(quantity) <= 0) {
            toast.error('Please select a product and enter a valid quantity.');
            return;
        }
        // Removed batch and expiry validation checks, they are now optional
        if (Number(salePrice) <= 0) {
            toast.error('Sale Price must be greater than 0.');
            return;
        }

        // Check against dynamically calculated stock
        const currentProductStock = calculateTotalStockForProduct(productName);
        const quantityAlreadyInCurrentSale = currentSale.items.reduce((sum, item) => {
            return item.productId === currentSaleItem.productId && item.batch === currentSaleItem.batch
                ? sum + Number(item.quantity)
                : sum;
        }, 0);

        const effectiveAvailableStock = currentProductStock - quantityAlreadyInCurrentSale;

        if (Number(quantity) > effectiveAvailableStock) {
            toast.error(`Not enough stock for "${productName}" (Batch: ${batch}). Available: ${effectiveAvailableStock || 0} items.`);
            return;
        }

        const newItem = { ...currentSaleItem, quantity: Number(quantity) };
        setCurrentSale(prev => ({
            ...prev,
            items: [...prev.items, newItem],
        }));

        // Clear current sale item form
        setCurrentSaleItem({
            productId: '', productName: '', unit: '', category: '', batch: '', expiry: '', quantity: '', mrp: '',
            salePrice: '', discount: '', taxRate: '', itemSubtotal: 0, itemDiscountAmount: 0, itemTaxAmount: 0, itemTotal: 0,
            hsn: '', schedule: '', barcode: '',
        });
        setSearchQuery('');
        toast.success(`"${productName}" added to sale.`);
    };

    // Handle editing an item already added to the current sale
    const handleEditCurrentSaleItem = (index, field, value) => {
        setCurrentSale(prevSale => {
            const updatedItems = [...prevSale.items];
            const itemToUpdate = { ...updatedItems[index] };

            // Update the specific field
            itemToUpdate[field] = value;

            // Recalculate item totals based on updated values
            const quantity = Number(itemToUpdate.quantity) || 0;
            const salePrice = Number(itemToUpdate.salePrice) || 0;
            const discount = Number(itemToUpdate.discount) || 0;
            const taxRate = Number(itemToUpdate.taxRate) || 0;

            const itemSubtotal = quantity * salePrice;
            const itemDiscountAmount = itemSubtotal * (discount / 100);
            const itemAmountAfterDiscount = itemSubtotal - itemDiscountAmount;
            const itemTaxAmount = itemAmountAfterDiscount * (taxRate / 100);
            const itemTotal = itemAmountAfterDiscount + itemTaxAmount;

            itemToUpdate.itemSubtotal = itemSubtotal;
            itemToUpdate.itemDiscountAmount = itemDiscountAmount;
            itemToUpdate.itemTaxAmount = itemTaxAmount;
            itemToUpdate.itemTotal = itemTotal;

            // --- Stock Check on Edit ---
            const currentProductStock = calculateTotalStockForProduct(itemToUpdate.productName);
            // Sum of quantities for this product (and batch) from other items in the current sale (excluding the one being edited)
            const otherItemsQuantityInCurrentSale = updatedItems.reduce((sum, item, i) => {
                return i !== index && item.productId === itemToUpdate.productId && item.batch === itemToUpdate.batch
                    ? sum + Number(item.quantity)
                    : sum;
            }, 0);

            const effectiveAvailableStock = currentProductStock - otherItemsQuantityInCurrentSale;

            if (Number(itemToUpdate.quantity) > effectiveAvailableStock) {
                toast.error(`Not enough stock for "${itemToUpdate.productName}" (Batch: ${itemToUpdate.batch}). Available: ${effectiveAvailableStock || 0} items. Cannot set quantity to ${itemToUpdate.quantity}.`);
                // Revert the quantity to the maximum available if the user tries to exceed stock
                itemToUpdate.quantity = effectiveAvailableStock;
                // Recalculate totals for the reverted quantity
                const revertedQuantity = effectiveAvailableStock;
                const revertedItemSubtotal = revertedQuantity * salePrice;
                const revertedItemDiscountAmount = revertedItemSubtotal * (discount / 100);
                const revertedItemAmountAfterDiscount = revertedItemSubtotal - revertedItemDiscountAmount;
                const revertedItemTaxAmount = revertedItemAmountAfterDiscount * (taxRate / 100);
                const revertedItemTotal = revertedItemAmountAfterDiscount + revertedItemTaxAmount;

                itemToUpdate.itemSubtotal = revertedItemSubtotal;
                itemToUpdate.itemDiscountAmount = revertedItemDiscountAmount;
                itemToUpdate.itemTaxAmount = revertedItemTaxAmount;
                itemToUpdate.itemTotal = revertedItemTotal;
            }
            // --- End Stock Check on Edit ---

            updatedItems[index] = itemToUpdate;
            return { ...prevSale, items: updatedItems };
        });
        toast.success(`Item updated.`); // Moved outside to avoid multiple toasts on single change
    };


    // Remove item from current sale
    const handleRemoveItem = (index) => {
        const updatedItems = currentSale.items.filter((_, i) => i !== index);
        setCurrentSale(prev => ({ ...prev, items: updatedItems }));
        toast.info('Item removed from sale.');
    };

    // Save or Update a Sale
    const handleSaveSale = () => {
        if (!currentSale.customerName.trim()) {
            toast.error('Customer Name is required.');
            return;
        }
        if (!currentSale.saleDate) {
            toast.error('Sale Date is required.');
            return;
        }
        if (currentSale.items.length === 0) {
            toast.error('Please add at least one item to the sale.');
            return;
        }

        // Final stock check before saving (critical)
        const productQuantitiesInCurrentSale = new Map();
        currentSale.items.forEach(item => {
            const key = `${item.productId}_${item.batch}`;
            productQuantitiesInCurrentSale.set(key, (productQuantitiesInCurrentSale.get(key) || 0) + Number(item.quantity));
        });

        for (const [key, quantityInSale] of productQuantitiesInCurrentSale.entries()) {
            const [productId, batch] = key.split('_');
            const productInMaster = products.find(p => p.id === productId);

            if (productInMaster) {
                const currentStockForProductBatch = getStockByBatch(productInMaster.name).find(b => b.batch === batch)?.quantity || 0;

                let quantityFromPreviousSale = 0;
                if (editingSaleId) {
                    const previousSale = sales.find(s => s.id === editingSaleId);
                    if (previousSale) {
                        quantityFromPreviousSale = previousSale.items.reduce((sum, prevItem) => {
                            return prevItem.productId === productId && prevItem.batch === batch
                                ? sum + Number(prevItem.quantity)
                                : sum;
                        }, 0);
                    }
                }

                // Calculate the net change this sale will cause to the stock
                const netChange = quantityInSale - quantityFromPreviousSale;

                if (currentStockForProductBatch < netChange) {
                    toast.error(`Insufficient stock for "${productInMaster.name}" (Batch: ${batch}). Available: ${currentStockForProductBatch}. Attempting to sell: ${quantityInSale} (net change: ${netChange}).`);
                    return; // Prevent saving if stock is insufficient
                }
            } else {
                toast.warning(`Product with ID ${productId} not found in master data. Stock check skipped for this item.`);
            }
        }


        const saleToSave = {
            ...currentSale,
            id: editingSaleId || `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            // Ensure numbers are stored as numbers, not strings from input
            subTotal: Number(currentSale.subTotal),
            totalDiscount: Number(currentSale.totalDiscount),
            totalTax: Number(currentSale.totalTax),
            grandTotal: Number(currentSale.grandTotal),
            paidAmount: Number(currentSale.paidAmount),
            balanceAmount: Number(currentSale.balanceAmount),
            items: currentSale.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                mrp: Number(item.mrp),
                salePrice: Number(item.salePrice),
                discount: Number(item.discount),
                taxRate: Number(item.taxRate),
                itemSubtotal: Number(item.itemSubtotal),
                itemDiscountAmount: Number(item.itemDiscountAmount),
                itemTaxAmount: Number(item.itemTaxAmount),
                itemTotal: Number(item.itemTotal),
            })),
        };

        let updatedSales;
        if (editingSaleId) {
            updatedSales = sales.map(s => (s.id === editingSaleId ? saleToSave : s));
            toast.success(`Sale to ${saleToSave.customerName} updated successfully!`);
        } else {
            updatedSales = [...sales, saleToSave];
            toast.success(`Sale to ${saleToSave.customerName} saved successfully!`);
        }

        setSales(updatedSales);
        localStorage.setItem('sales', JSON.stringify(updatedSales));
        // Dispatch event to notify other components (including this one to re-calculate stock)
        window.dispatchEvent(new Event('salesUpdated'));
        window.dispatchEvent(new Event('productsUpdated')); // Also notify products page if it relies on sales

        handleClearSale(); // Clear form after saving
    };

    // Edit a Sale
    const handleEditSale = (sale) => {
        setEditingSaleId(sale.id);
        setCurrentSale({
            ...sale,
            paidAmount: sale.paidAmount.toString(), // Convert to string for input field
        });
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top of the form
    };

    // Delete a Sale
    const handleDeleteSale = (id) => {
        if (window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
            const updatedSales = sales.filter(sale => sale.id !== id);
            setSales(updatedSales);
            localStorage.setItem('sales', JSON.stringify(updatedSales));
            // Dispatch event to notify other components (including this one to re-calculate stock)
            window.dispatchEvent(new Event('salesUpdated'));
            window.dispatchEvent(new Event('productsUpdated')); // Also notify products page if it relies on sales
            toast.success('Sale deleted successfully.');
        }
    };

    // Clear the current sale form
    const handleClearSale = () => {
        setEditingSaleId(null);
        setCurrentSale({
            id: null,
            customerName: '',
            saleDate: formatDate(new Date()),
            items: [],
            subTotal: 0,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: 0,
            paidAmount: '',
            balanceAmount: 0,
            paymentMethod: 'Cash',
            notes: '',
        });
        setCurrentSaleItem({
            productId: '', productName: '', unit: '', category: '', batch: '', expiry: '', quantity: '', mrp: '',
            salePrice: '', discount: '', taxRate: '', itemSubtotal: 0, itemDiscountAmount: 0, itemTaxAmount: 0, itemTotal: 0,
            hsn: '', schedule: '', barcode: '',
        });
        setSearchQuery('');
        setIsProductListVisible(false);
        toast.info('Sale form cleared.');
    };

    // Toggle sales row expansion
    const toggleExpansion = (id) => {
        setExpandedSaleId(expandedSaleId === id ? null : id);
    };

    // View Sale in Modal
    const handleViewSale = (sale) => {
        setViewingSale(sale);
        setIsViewModalOpen(true);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setViewingSale(null);
    };

    // PDF Generation
    const generatePdf = useCallback(() => {
        if (!viewingSale) return;

        const input = viewModalRef.current;
        if (!input) {
            toast.error("Could not find modal content to generate PDF.");
            return;
        }

        toast.info("Generating PDF, please wait...");

        html2canvas(input, { scale: 2, useCORS: true, logging: true }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`Sale_Invoice_${viewingSale.customerName.replace(/\s/g, '_')}_${formatDate(viewingSale.saleDate)}.pdf`);
            toast.success("PDF generated successfully!");
        }).catch(error => {
            console.error("Error generating PDF:", error);
            toast.error("Failed to generate PDF. Please try again.");
        });
    }, [viewingSale]);

    // Memoized filtered and sorted sales for display
    const filteredAndSortedSales = useMemo(() => {
        let filtered = sales.filter(sale =>
            sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.items.some(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (sortColumn) {
            filtered.sort((a, b) => {
                let aValue = a[sortColumn];
                let bValue = b[sortColumn];

                if (sortColumn === 'saleDate') {
                    aValue = parseDate(aValue)?.getTime() || 0;
                    bValue = parseDate(bValue)?.getTime() || 0;
                } else if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [sales, searchQuery, sortColumn, sortDirection]);

    // Pagination logic
    const indexOfLastSale = currentPage * salesPerPage;
    const indexOfFirstSale = indexOfLastSale - salesPerPage;
    const currentFilteredAndSortedSales = useMemo(() => {
        return filteredAndSortedSales.slice(indexOfFirstSale, indexOfLastSale);
    }, [filteredAndSortedSales, indexOfFirstSale, indexOfLastSale]);

    const totalPages = Math.ceil(filteredAndSortedSales.length / salesPerPage);

    const paginate = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page on sort
    };

    return (
        <>
            <Header />
            <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-100 rounded-lg shadow-inner fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">Sales</h2>
                    <Button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                        Go to Dashboard
                    </Button>
                </div>

                {/* Sales Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
                        {editingSaleId ? 'Edit Sale' : 'New Sale'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                            <input
                                type="text"
                                id="customerName"
                                name="customerName"
                                value={currentSale.customerName}
                                onChange={handleSaleChange}
                                placeholder="Enter customer name"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                            <input
                                type="text"
                                id="saleDate"
                                name="saleDate"
                                value={currentSale.saleDate}
                                onChange={handleSaleChange}
                                placeholder="DD-MM-YYYY"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    {/* Add Item Section */}
                    <h4 className="text-xl font-semibold text-gray-700 mb-3 border-b pb-2 border-gray-200">Add Item to Sale</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="relative">
                            <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                            <input
                                type="text"
                                id="productName"
                                name="productName"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentSaleItem(prev => ({ ...prev, productName: e.target.value }));
                                    setIsProductListVisible(true);
                                }}
                                onFocus={() => setIsProductListVisible(true)}
                                onBlur={() => setTimeout(() => setIsProductListVisible(false), 200)} // Delay to allow click
                                placeholder="Search & Select Product"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                ref={productSearchRef}
                            />
                            {isProductListVisible && searchQuery && filteredProducts.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredProducts.map(product => {
                                        // Display calculated current stock
                                        const displayStock = product.calculatedCurrentStock;
                                        return (
                                            <li
                                                key={product.id}
                                                onMouseDown={() => handleProductSelect(product)} // Use onMouseDown to trigger before onBlur
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-800 text-sm"
                                            >
                                                {product.name} ({product.unit}) - Stock: {displayStock}
                                                {displayStock <= 0 && <AlertTriangle className="inline-block h-4 w-4 ml-2 text-red-500" title="Out of Stock" />}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {isProductListVisible && searchQuery && filteredProducts.length === 0 && (
                                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1 px-3 py-2 text-sm text-gray-500">
                                    No products found.
                                </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-1">Batch No.</label>
                            <input
                                type="text"
                                id="batch"
                                name="batch"
                                value={currentSaleItem.batch}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., B12345"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">Expiry (MM-YYYY)</label>
                            <input
                                type="text"
                                id="expiry"
                                name="expiry"
                                value={currentSaleItem.expiry}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 12-2025"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                                type="number"
                                id="quantity"
                                name="quantity"
                                value={currentSaleItem.quantity}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                min="1"
                            />
                        </div>
                        {/* Sale Price input field for override/display */}
                        <div>
                            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700 mb-1">Sale Price / Pack</label>
                            <input
                                type="number"
                                id="salePrice"
                                name="salePrice"
                                value={currentSaleItem.salePrice}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 89.99"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div>
                            <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                            <input
                                type="number"
                                id="discount"
                                name="discount"
                                value={currentSaleItem.discount}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 10"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                        </div>
                        <div>
                            <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                            <input
                                type="number"
                                id="taxRate"
                                name="taxRate"
                                value={currentSaleItem.taxRate}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 18"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                        </div>
                        <div className="col-span-full md:col-span-1 lg:col-span-1">
                            <label htmlFor="itemTotal" className="block text-sm font-medium text-gray-700 mb-1">Item Total</label>
                            <input
                                type="text"
                                id="itemTotal"
                                name="itemTotal"
                                value={`₹${currentSaleItem.itemTotal.toFixed(2)}`}
                                readOnly
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            onClick={handleAddItemToSale}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </div>

                    {/* Sale Items Table */}
                    {currentSale.items.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-xl font-semibold text-gray-700 mb-3">Items in Current Sale</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm mb-4">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry (MM-YYYY)</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disc (%)</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax (%)</th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                            <th className="px-3 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {currentSale.items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.productName} ({item.unit})</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.batch}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                    <input
                                                        type="text"
                                                        value={item.expiry}
                                                        onChange={(e) => handleEditCurrentSaleItem(index, 'expiry', e.target.value)}
                                                        className="w-24 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        placeholder="MM-YYYY"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleEditCurrentSaleItem(index, 'quantity', e.target.value)}
                                                        className="w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.mrp).toFixed(2)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                    <input
                                                        type="number"
                                                        value={item.salePrice}
                                                        onChange={(e) => handleEditCurrentSaleItem(index, 'salePrice', e.target.value)}
                                                        className="w-24 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                    <input
                                                        type="number"
                                                        value={item.discount}
                                                        onChange={(e) => handleEditCurrentSaleItem(index, 'discount', e.target.value)}
                                                        className="w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                    />%
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                                                    <input
                                                        type="number"
                                                        value={item.taxRate}
                                                        onChange={(e) => handleEditCurrentSaleItem(index, 'taxRate', e.target.value)}
                                                        className="w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                    />%
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.itemTotal).toFixed(2)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-colors duration-200"
                                                        title="Remove Item"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Sale Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div>
                            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                            <select
                                id="paymentMethod"
                                name="paymentMethod"
                                value={currentSale.paymentMethod}
                                onChange={handleSaleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                            <input
                                type="number"
                                id="paidAmount"
                                name="paidAmount"
                                value={currentSale.paidAmount}
                                onChange={handleSaleChange}
                                placeholder="e.g., 1000.00"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div className="col-span-full">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={currentSale.notes}
                                onChange={handleSaleChange}
                                rows="2"
                                placeholder="Any additional notes for this sale..."
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            ></textarea>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800">
                        <div className="flex justify-between items-center py-1">
                            <span className="font-medium">Subtotal:</span>
                            <span>₹{currentSale.subTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="font-medium">Total Discount:</span>
                            <span>- ₹{currentSale.totalDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="font-medium">Total Tax:</span>
                            <span>+ ₹{currentSale.totalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-blue-300 mt-2 text-lg font-bold">
                            <span>Grand Total:</span>
                            <span>₹{currentSale.grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 text-base">
                            <span className="font-medium">Paid Amount:</span>
                            <span>₹{Number(currentSale.paidAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 text-base">
                            <span className="font-medium">Balance Amount:</span>
                            <span className={currentSale.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                                ₹{currentSale.balanceAmount.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <Button
                            onClick={handleClearSale}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" /> Clear Sale
                        </Button>
                        <Button
                            onClick={handleSaveSale}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <Save className="mr-2 h-4 w-4" /> {editingSaleId ? 'Update Sale' : 'Save Sale'}
                        </Button>
                    </div>
                </div>

                {/* Sales List */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-semibold text-gray-700">Recent Sales</h3>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search sales..."
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
                                        onClick={() => handleSort('customerName')}
                                    >
                                        Customer Name
                                        {sortColumn === 'customerName' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('saleDate')}
                                    >
                                        Sale Date
                                        {sortColumn === 'saleDate' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('grandTotal')}
                                    >
                                        Grand Total
                                        {sortColumn === 'grandTotal' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('paidAmount')}
                                    >
                                        Paid
                                        {sortColumn === 'paidAmount' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('balanceAmount')}
                                    >
                                        Balance
                                        {sortColumn === 'balanceAmount' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentFilteredAndSortedSales.length > 0 ? (
                                    currentFilteredAndSortedSales.map((sale) => (
                                        <React.Fragment key={sale.id}>
                                            <tr className="hover:bg-gray-100 transition duration-100 ease-in-out">
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{sale.customerName}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{sale.saleDate}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{sale.grandTotal.toFixed(2)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(sale.paidAmount).toFixed(2)}</td>
                                                <td className={`px-3 py-2 whitespace-nowrap text-sm ${sale.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    ₹{sale.balanceAmount.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleViewSale(sale)}
                                                            className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors duration-200"
                                                            title="View Sale Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleEditSale(sale)}
                                                            className="p-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 transition-colors duration-200"
                                                            title="Edit Sale"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleDeleteSale(sale.id)}
                                                            className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-colors duration-200"
                                                            title="Delete Sale"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => toggleExpansion(sale.id)}
                                                            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors duration-200"
                                                            title={expandedSaleId === sale.id ? "Collapse Details" : "Expand Details"}
                                                        >
                                                            {expandedSaleId === sale.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedSaleId === sale.id && (
                                                <tr className="bg-indigo-50 fade-in-item">
                                                    <td colSpan="7" className="px-3 py-2">
                                                        <div className="expandable-content p-2">
                                                            <h5 className="font-semibold text-indigo-800 mb-2">Items:</h5>
                                                            <ul className="list-disc list-inside text-sm text-indigo-700">
                                                                {sale.items.map((item, itemIndex) => (
                                                                    <li key={itemIndex}>
                                                                        {item.productName} ({item.unit}) - Batch: {item.batch}, Expiry: {item.expiry}, Qty: {item.quantity}, Price: ₹{Number(item.salePrice).toFixed(2)}, Total: ₹{Number(item.itemTotal).toFixed(2)}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            <p className="text-sm text-indigo-700 mt-2">
                                                                <span className="font-semibold">Payment Method:</span> {sale.paymentMethod}
                                                            </p>
                                                            {sale.notes && (
                                                                <p className="text-sm text-indigo-700 mt-1">
                                                                    <span className="font-semibold">Notes:</span> {sale.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-3 py-4 text-center text-sm text-gray-500">
                                            {searchQuery ? "No sales match your search." : "No sales recorded yet."}
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

                    {currentFilteredAndSortedSales.length === 0 && sales.length > 0 && searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No sales match your current search query.</p>
                    )}
                    {currentFilteredAndSortedSales.length === 0 && sales.length > 0 && !searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No sales available after filtering/sorting.</p>
                    )}
                </div>
            </div>

            {/* View Sale Modal */}
            {isViewModalOpen && viewingSale && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 fade-in-backdrop">
                    <div ref={viewModalRef} className="bg-white p-6 rounded-lg shadow-xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold text-gray-800">Sale Details</h3>
                            <Button
                                onClick={handleCloseViewModal}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                            >
                                <X className="h-5 w-5 text-gray-600" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-gray-700">
                            <div>
                                <p className="font-semibold">Customer Name:</p>
                                <p>{viewingSale.customerName}</p>
                            </div>
                            <div>
                                <p className="font-semibold">Sale Date:</p>
                                <p>{viewingSale.saleDate}</p>
                            </div>
                            <div>
                                <p className="font-semibold">Payment Method:</p>
                                <p>{viewingSale.paymentMethod}</p>
                            </div>
                            {viewingSale.notes && (
                                <div>
                                    <p className="font-semibold">Notes:</p>
                                    <p>{viewingSale.notes}</p>
                                </div>
                            )}
                        </div>

                        <h4 className="text-xl font-semibold text-gray-700 mb-3 border-b pb-2 border-gray-200">Items Sold</h4>
                        <div className="overflow-x-auto mb-4 border border-gray-200 rounded-md">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disc (%)</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax (%)</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {viewingSale.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.productName} ({item.unit})</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.batch}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.expiry}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantity}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.salePrice).toFixed(2)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{Number(item.discount).toFixed(2)}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{Number(item.taxRate).toFixed(2)}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.itemTotal).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800">
                            <div className="flex justify-between items-center py-1">
                                <span className="font-medium">Subtotal:</span>
                                <span>₹{viewingSale.subTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="font-medium">Total Discount:</span>
                                <span>- ₹{viewingSale.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="font-medium">Total Tax:</span>
                                <span>+ ₹{viewingSale.totalTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-t border-blue-300 mt-2 text-lg font-bold">
                                <span>Grand Total:</span>
                                <span>₹{viewingSale.grandTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 text-base">
                                <span className="font-medium">Paid Amount:</span>
                                <span>₹{Number(viewingSale.paidAmount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 text-base">
                                <span className="font-medium">Balance Amount:</span>
                                <span className={viewingSale.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                                    ₹{viewingSale.balanceAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <Button
                                onClick={generatePdf}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <Printer className="mr-2 h-4 w-4" /> Print/Download Bill
                            </Button>
                            {/* You might want to add a "Send Bill" functionality here */}
                            <div className="hidden"> {/* Placeholder for Send Bill functionality */}
                                <Button
                                    onClick={() => toast.info('Send Bill functionality coming soon!')}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                    <Share2 className="mr-2 h-4 w-4" /> Send Bill
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* The style tag should be directly within the Fragment or the root div */}
            <style jsx>{`
                .fade-in-backdrop {
                    animation: fadeInBackdrop 0.3s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeInBackdrop {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }

                .animate-scale-in {
                    animation: scaleIn 0.3s ease-out forwards;
                }
                @keyframes scaleIn {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
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

                /* Fade-in animation for the main content */
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0; /* Start invisible */
                }

                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); } /* Optional: slight slide up */
                    100% { opacity: 1; transform: translateY(0); }\
                }

                /* Slide animation for expandable row content */
                .expandable-content {
                    overflow: hidden; /* Hide content when collapsed */
                    transition: max-height 0.3s ease-out; /* Smooth transition */
                    max-height: 0; /* Start collapsed */
                }

                /* This class is applied by React when the row is expanded */
                tr.bg-indigo-50 + tr .expandable-content {
                    max-height: 500px; /* A large enough value to accommodate the content */
                }
            `}</style>
        </>
    );
}

export default SalesPage;
