const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Use environment variables for security. Do NOT hardcode your secret key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_PLACEHOLDER");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Correctly define the secret dependency so it's available in process.env
exports.createStripeCheckout = functions
  .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send("Method Not Allowed");
        }

        try {
            const { amount, orderId, email } = req.body;

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "lkr",
                            product_data: {
                                name: `N-Cafe Order #${orderId}`,
                            },
                            unit_amount: Math.round(amount * 100), // Stripe expects cents
                        },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: `https://rtdesilva.github.io/ncafe/?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
                cancel_url: `https://rtdesilva.github.io/ncafe/`,
                customer_email: email,
            });

            res.status(200).send({ id: session.id, url: session.url });
        } catch (error) {
            console.error("Stripe Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
