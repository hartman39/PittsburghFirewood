// Initialize Stripe (replace with your publishable key)
const stripe = Stripe('pk_test_51234567890abcdefghijklmnop');

// Shopping Cart
let cart = [];
let subscriptions = [];

// Product data
const products = {
    bundle: {
        name: 'Bundle',
        price: 9.99,
        unit: 'bundle',
        description: '0.75 cubic feet'
    },
    halffacecord: {
        name: '1/2 Face Cord',
        price: 219,
        unit: 'delivery',
        description: '21.33 cubic feet'
    },
    facecord: {
        name: '1 Face Cord',
        price: 399,
        unit: 'delivery',
        description: '42.67 cubic feet'
    },
    ibctote: {
        name: 'IBC Tote',
        price: 349,
        unit: 'delivery',
        description: '35.3 cubic feet'
    }
};

// Subscription pricing (10% discount)
const subscriptionPricing = {
    'bundle-10': 92.50,
    'halffacecord': 197,
    'facecord': 359,
    'ibctote': 314
};

// Database simulation (would be replaced with actual backend)
class Database {
    constructor() {
        this.customers = JSON.parse(localStorage.getItem('customers')) || [];
        this.subscriptions = JSON.parse(localStorage.getItem('subscriptions')) || [];
        this.orders = JSON.parse(localStorage.getItem('orders')) || [];
    }

    saveCustomer(customer) {
        customer.id = Date.now().toString();
        customer.createdAt = new Date().toISOString();
        this.customers.push(customer);
        this.save();
        return customer;
    }

    saveSubscription(subscription) {
        subscription.id = Date.now().toString();
        subscription.createdAt = new Date().toISOString();
        subscription.status = 'active';
        subscription.nextDelivery = this.calculateNextDelivery(subscription.frequency);
        this.subscriptions.push(subscription);
        this.save();
        return subscription;
    }

    saveOrder(order) {
        order.id = Date.now().toString();
        order.createdAt = new Date().toISOString();
        order.status = 'pending';
        this.orders.push(order);
        this.save();
        return order;
    }

    calculateNextDelivery(frequency) {
        const date = new Date();
        switch(frequency) {
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'bimonthly':
                date.setMonth(date.getMonth() + 2);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            default:
                date.setMonth(date.getMonth() + 1);
        }
        return date.toISOString();
    }

    getCustomerByEmail(email) {
        return this.customers.find(c => c.email === email);
    }

    getCustomerSubscriptions(customerId) {
        return this.subscriptions.filter(s => s.customerId === customerId);
    }

    updateSubscriptionStatus(subscriptionId, status) {
        const sub = this.subscriptions.find(s => s.id === subscriptionId);
        if (sub) {
            sub.status = status;
            sub.updatedAt = new Date().toISOString();
            this.save();
        }
        return sub;
    }

    save() {
        localStorage.setItem('customers', JSON.stringify(this.customers));
        localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
        localStorage.setItem('orders', JSON.stringify(this.orders));
    }
}

const db = new Database();

// Cart functions
function addToCart(productId) {
    const product = products[productId];
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: productId,
            ...product,
            quantity: 1
        });
    }

    updateCartDisplay();
    showNotification(`${product.name} added to cart!`);
}

function updateCartDisplay() {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Update cart icon count
    let cartBadge = document.querySelector('.cart-badge');
    if (!cartBadge && cartCount > 0) {
        const accountBtn = document.querySelector('.btn-account');
        cartBadge = document.createElement('span');
        cartBadge.className = 'cart-badge';
        accountBtn.parentNode.insertBefore(cartBadge, accountBtn);
    }

    if (cartBadge) {
        cartBadge.textContent = cartCount;
        cartBadge.style.display = cartCount > 0 ? 'inline-block' : 'none';
    }
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Form handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add to cart buttons
    document.querySelectorAll('.btn-add-cart').forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-product');
            addToCart(productId);
        });
    });

    // Subscription form
    const subForm = document.getElementById('subscription-form');
    if (subForm) {
        subForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const subscriptionData = {
                product: formData.get('product'),
                frequency: formData.get('frequency'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                address: {
                    street: formData.get('address'),
                    city: formData.get('city'),
                    state: formData.get('state'),
                    zip: formData.get('zip')
                }
            };

            // Check if customer exists
            let customer = db.getCustomerByEmail(subscriptionData.email);
            if (!customer) {
                customer = db.saveCustomer({
                    email: subscriptionData.email,
                    phone: subscriptionData.phone,
                    address: subscriptionData.address
                });
            }

            // Save subscription
            const subscription = db.saveSubscription({
                customerId: customer.id,
                product: subscriptionData.product,
                frequency: subscriptionData.frequency,
                price: subscriptionPricing[subscriptionData.product],
                address: subscriptionData.address
            });

            // Process payment with Stripe
            try {
                await processSubscriptionPayment(subscription);
                showNotification('Subscription created successfully! You will receive your first delivery soon.');
                this.reset();
            } catch (error) {
                showNotification('Payment processing failed. Please try again.', 'error');
                console.error('Payment error:', error);
            }
        });
    }

    // Contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const contactData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                message: formData.get('message'),
                timestamp: new Date().toISOString()
            };

            // Save to local storage (would send to backend in production)
            const contacts = JSON.parse(localStorage.getItem('contacts')) || [];
            contacts.push(contactData);
            localStorage.setItem('contacts', JSON.stringify(contacts));

            showNotification('Thank you for your message! We will get back to you within 24 hours.');
            this.reset();
        });
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Sticky header effect
    const header = document.querySelector('header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll <= 0) {
            header.classList.remove('scroll-up');
            return;
        }

        if (currentScroll > lastScroll && !header.classList.contains('scroll-down')) {
            header.classList.remove('scroll-up');
            header.classList.add('scroll-down');
        } else if (currentScroll < lastScroll && header.classList.contains('scroll-down')) {
            header.classList.remove('scroll-down');
            header.classList.add('scroll-up');
        }

        lastScroll = currentScroll;
    });

    // Initialize cart display
    updateCartDisplay();
});

// Stripe payment processing
async function processSubscriptionPayment(subscription) {
    // This would integrate with Stripe's subscription API
    // For demo purposes, we'll simulate a successful payment
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.1) { // 90% success rate for demo
                resolve({ success: true, subscriptionId: subscription.id });
            } else {
                reject(new Error('Payment declined'));
            }
        }, 1500);
    });
}

async function processOneTimePayment(order) {
    // This would integrate with Stripe's payment API
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.1) { // 90% success rate for demo
                resolve({ success: true, orderId: order.id });
            } else {
                reject(new Error('Payment declined'));
            }
        }, 1500);
    });
}

// Customer portal functions
function loadCustomerPortal(email) {
    const customer = db.getCustomerByEmail(email);
    if (!customer) {
        showNotification('Customer not found', 'error');
        return;
    }

    const subscriptions = db.getCustomerSubscriptions(customer.id);

    // Display customer info and subscriptions
    console.log('Customer:', customer);
    console.log('Subscriptions:', subscriptions);

    // This would render a customer portal UI
}

function pauseSubscription(subscriptionId) {
    const subscription = db.updateSubscriptionStatus(subscriptionId, 'paused');
    if (subscription) {
        showNotification('Subscription paused successfully');
    }
}

function resumeSubscription(subscriptionId) {
    const subscription = db.updateSubscriptionStatus(subscriptionId, 'active');
    if (subscription) {
        showNotification('Subscription resumed successfully');
    }
}

function cancelSubscription(subscriptionId) {
    const subscription = db.updateSubscriptionStatus(subscriptionId, 'cancelled');
    if (subscription) {
        showNotification('Subscription cancelled');
    }
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification-success {
        background: #4CAF50;
    }

    .notification-error {
        background: #f44336;
    }

    .cart-badge {
        background: #FF6B35;
        color: white;
        border-radius: 50%;
        padding: 0.2rem 0.5rem;
        font-size: 0.8rem;
        margin-left: 0.5rem;
        font-weight: bold;
    }

    header.scroll-down {
        transform: translateY(-100%);
        transition: transform 0.3s ease;
    }

    header.scroll-up {
        transform: translateY(0);
        transition: transform 0.3s ease;
    }
`;
document.head.appendChild(notificationStyles);