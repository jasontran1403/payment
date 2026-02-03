import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
    Offcanvas,
    Modal,
    Button,
    Image,
    Spinner,
    Alert,
} from "react-bootstrap";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { toast } from "react-toastify";

// Lazy load Stripe
let stripePromise = null;
const getStripe = () => {
    if (!stripePromise) {
        stripePromise = loadStripe(
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
        );
    }
    return stripePromise;
};

const CheckoutForm = ({ onSuccess, onError }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!stripe || !elements) {
            setMessage("Stripe chưa sẵn sàng. Vui lòng thử lại.");
            return;
        }

        setIsLoading(true);
        setMessage("");

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
            });

            if (error) {
                let errorMsg = "Có lỗi xảy ra khi xử lý thanh toán.";
                if (
                    error.type === "card_error" ||
                    error.type === "validation_error"
                ) {
                    errorMsg = error.message;
                }
                setMessage(errorMsg);
                onError(errorMsg);
                toast.error(errorMsg, {
                    position: "top-center",
                    autoClose: 5000,
                });
            } else if (paymentIntent) {
                if (paymentIntent.status === "succeeded") {
                    setMessage("Thanh toán thành công!");
                    onSuccess();
                    toast.success(
                        "Thanh toán thành công! Chúng tôi sẽ liên hệ sớm.",
                        {
                            position: "top-center",
                            autoClose: 3000,
                        }
                    );
                } else if (paymentIntent.status === "requires_action") {
                    setMessage("Vui lòng xác thực thanh toán (3D Secure)...");
                } else {
                    const msg = `Thanh toán chưa hoàn tất (status: ${paymentIntent.status}). Vui lòng thử lại.`;
                    setMessage(msg);
                    toast.warning(msg, { position: "top-center" });
                }
            }
        } catch (err) {
            const errMsg = `Lỗi hệ thống thanh toán: ${err.message}`;
            setMessage(errMsg);
            onError(errMsg);
            toast.error(errMsg, { position: "top-center" });
        }

        setIsLoading(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement
                id="payment-element"
                options={{
                    wallets: {
                        applePay: "never",
                        googlePay: "never",
                    },
                }}
            />
            <Button
                variant="primary"
                size="lg"
                className="w-100 mt-4"
                disabled={isLoading || !stripe || !elements}
                type="submit"
            >
                {isLoading ? (
                    <>
                        <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                        />
                        Đang xử lý...
                    </>
                ) : (
                    "Xác nhận thanh toán"
                )}
            </Button>

            {message && (
                <Alert
                    variant={
                        message.includes("Thành công") ? "success" : "danger"
                    }
                    className="mt-3"
                >
                    {message}
                </Alert>
            )}
        </form>
    );
};

CheckoutForm.propTypes = {
    onSuccess: PropTypes.func.isRequired,
    onError: PropTypes.func.isRequired,
};

const ProductDetailPanel = ({ product, isOpen, onClose }) => {
    const [clientSecret, setClientSecret] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);

    // Reset khi đóng panel
    useEffect(() => {
        if (!isOpen) {
            setClientSecret(null);
            setError(null);
            setSuccess(false);
            setIsInitializing(false);
        }
    }, [isOpen]);

    // Đóng bằng Esc
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    if (!product) return null;

    const priceAmount = product.price?.amount ?? 0;
    const taxRate = 0.08;
    const tax = priceAmount * taxRate;
    const total = priceAmount + tax;

    const initializePayment = async () => {
        if (clientSecret || isInitializing) return;

        setIsInitializing(true);
        setError(null);

        try {
            const response = await fetch(
                "https://ghoul-helpful-salmon.ngrok-free.app/api/auth/create-payment-intent",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: product.id,
                        title: product.title,
                        amount: total,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                const errMsg = data.message || "Lỗi từ server";
                setError(errMsg);
                toast.error(errMsg, { position: "top-center" });
                return;
            }

            setClientSecret(data.data.clientSecret);
        } catch (err) {
            const errMsg = `Không thể khởi tạo thanh toán: ${err.message}`;
            setError(errMsg);
            toast.error(errMsg, { position: "top-center" });
        } finally {
            setIsInitializing(false);
        }
    };

    const handleSuccess = () => {
        setSuccess(true);
        toast.success("Thanh toán thành công! Chúng tôi sẽ liên hệ sớm.", {
            position: "top-center",
            autoClose: 3000,
        });
        setTimeout(() => onClose(), 3500);
    };

    const handleError = (msg) => {
        setError(msg);
        toast.error(msg || "Thanh toán thất bại", { position: "top-center" });
    };

    const isMobile = typeof window !== "undefined" && window.innerWidth < 992;

    const content = (
        <>
            {product.images?.[0]?.src && (
                <div className="mb-4 text-center">
                    <Image
                        src={product.images[0].src}
                        alt={product.title}
                        fluid
                        rounded
                        className="shadow"
                        style={{ maxHeight: "300px", objectFit: "cover" }}
                    />
                </div>
            )}

            <div className="mb-3">
                <strong>Tên gói:</strong> {product.title || "Không có tên"}
            </div>
            <div className="mb-3">
                <strong>ID sản phẩm:</strong> #{product.id || "N/A"}
            </div>

            {priceAmount > 0 ? (
                <>
                    <div className="mb-3">
                        <strong>Giá:</strong>{" "}
                        <span className="text-primary fw-bold">
                            {product.price?.currency || "$"}
                            {priceAmount.toLocaleString()} / lần
                        </span>
                    </div>
                    <div className="mb-3">
                        <strong>Thuế (8%):</strong>{" "}
                        {product.price?.currency || "$"}
                        {tax.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                        })}
                    </div>
                    <hr />
                    <div className="mb-4">
                        <strong>Tổng thanh toán:</strong>{" "}
                        <span className="fs-4 fw-bold text-success">
                            {product.price?.currency || "$"}
                            {total.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                            })}
                        </span>
                    </div>
                </>
            ) : (
                <Alert variant="warning" className="mb-4">
                    Giá sản phẩm không hợp lệ hoặc chưa được thiết lập.
                </Alert>
            )}

            {error && (
                <Alert variant="danger" className="mb-4">
                    {error}
                </Alert>
            )}
            {success ? (
                <Alert variant="success" className="mb-4">
                    Thanh toán thành công! Chúng tôi sẽ liên hệ sớm.
                </Alert>
            ) : (
                <div className="mt-4">
                    {clientSecret ? (
                        <Elements
                            stripe={getStripe()}
                            options={{ clientSecret }}
                        >
                            <CheckoutForm
                                onSuccess={handleSuccess}
                                onError={handleError}
                            />
                        </Elements>
                    ) : (
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-100"
                            onClick={initializePayment}
                            disabled={isInitializing || priceAmount <= 0}
                        >
                            {isInitializing ? (
                                <>
                                    <Spinner
                                        animation="border"
                                        size="sm"
                                        className="me-2"
                                    />
                                    Đang khởi tạo thanh toán...
                                </>
                            ) : (
                                "Thanh toán ngay"
                            )}
                        </Button>
                    )}
                </div>
            )}

            <p className="text-center text-muted mt-3 small">
                Thanh toán an toàn qua Stripe (một lần) - Chỉ chấp nhận thẻ
            </p>
        </>
    );

    if (isMobile) {
        return (
            <Modal
                show={isOpen}
                onHide={onClose}
                centered
                size="lg"
                backdrop="static"
                keyboard
            >
                <Modal.Header closeButton>
                    <Modal.Title>Chi tiết gói dịch vụ</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">{content}</Modal.Body>
            </Modal>
        );
    }

    return (
        <Offcanvas show={isOpen} onHide={onClose} placement="end">
            <Offcanvas.Header closeButton>
                <Offcanvas.Title>Chi tiết gói dịch vụ</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-4">{content}</Offcanvas.Body>
        </Offcanvas>
    );
};

ProductDetailPanel.propTypes = {
    product: PropTypes.shape({
        id: PropTypes.number,
        title: PropTypes.string,
        price: PropTypes.shape({
            amount: PropTypes.number,
            currency: PropTypes.string,
        }),
        images: PropTypes.arrayOf(
            PropTypes.shape({
                src: PropTypes.string,
            })
        ),
    }),
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ProductDetailPanel;
