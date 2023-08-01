import Order from "../models/Orders.js";
import asyncHandler from "express-async-handler";
import User from "../models/Users.js";
import Product from "../models/Product.js";
import Stripe from "stripe";
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_KEY);


/**
 * @desc Create Orders
 * @route POST api/v1/orders
 * @access Private
 */
export const createOrder = asyncHandler(async (req, res) => {
    // get payload(customer, orderItems, shippingAddress, totalPrice)
    const { orderItems, shippingAddress, totalPrice } = req.body;
    // console.log({ orderItems, shippingAddress, totalPrice });
    // find user
    const user = await User.findById(req.userAuthId);

    if (!user?.hasShippingAddress) {
        throw new Error('Please provide shipping address');
    }

    // check if order is not empty
    console.log(orderItems?.length)
    if (!orderItems || orderItems?.length <= 0) {
        throw new Error('No Order items.');
    }
    // place/create order - saving
    const order = await Order.create({
        user: req.userAuthId,
        orderItems,
        shippingAddress,
        totalPrice
    });

    // update productQty & quantitySold
    orderItems?.map(async (order) => {
        // const product = products?.find((product) => String(product._id) === String(order?._id));
        const product = await Product.findById(order._id);
        console.log(product);
        if (product)
            product.totalSold += order.qty
        await product.save();
    });

    //push order into user
    user.orders.push(order?._id);
    await user.save();

    // make payment (stripe)'
    const line_items = orderItems.map(item => {
        return {
            price_data: {
                currency: 'inr',
                product_data: {
                    name: item?.name,
                    description: item?.description
                },
                unit_amount: item?.price * 100
            },
            quantity: item?.qty
        };
    })

    const session = await stripe.checkout.sessions.create(
        {
            line_items,
            metadata: {
                orderId: order?._id.toString()
            },
            mode: 'payment',
            success_url: 'https://localhost:3000/success',
            cancel_url: 'https://localhost:3000/cancel'
        }
    );
    res.send({ url: session.url });

    // payment webhook
    // update user order

    res.json({
        success: true,
        message: 'Order Created',
        order,
        user
    })
});

/**
 * @desc Get all orders
 * @route GET api/v1/orders
 * @access Public
 */
export const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find();
    res.json({
        status: 'Success',
        message: 'All orders fetched successfully',
        orders
    })
});

/**
 * @desc Get single orders
 * @route GET api/v1/orders/:id
 * @access Public
 */
export const getSingleOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    res.json({
        status: 'Success',
        message: 'Order fetched successfully',
        order
    })
});

/**
 * @desc Update order to be delivered
 * @route PUT api/v1/orders/update/:id/
 * @access Private/Admin
 */
export const updateOrder = asyncHandler(async (req, res) => {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id,
        {
            status: req.body.status.toLowerCase(),
        },
        {
            new: true
        }
    );

    res.json({
        success: true,
        message: 'Order Updated',
        updatedOrder
    });
});