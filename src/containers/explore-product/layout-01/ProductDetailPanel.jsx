import { useEffect, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
    Offcanvas,
    Modal,
    Button,
    Image,
    Spinner,
    Alert,
    Form,
} from "react-bootstrap";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { toast } from "react-toastify";

// Hàm làm tròn 2 chữ số thập phân
const roundToTwoDecimals = (num) =>
    Math.round((num + Number.EPSILON) * 100) / 100;

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

const CheckoutForm = ({ onSuccess, onError, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!stripe || !elements) {
            toast.error("Stripe chưa được khởi tạo đúng cách.", {
                position: "top-center",
            });
            return;
        }

        setIsLoading(true);

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
                toast.error(errorMsg, {
                    position: "top-center",
                    autoClose: 3000,
                });
                onError(errorMsg);
            } else if (paymentIntent) {
                if (paymentIntent.status === "succeeded") {
                    onSuccess();
                } else if (paymentIntent.status === "requires_action") {
                    toast.warning(
                        "Vui lòng xác thực thanh toán (3D Secure)...",
                        { position: "top-center", autoClose: 3000 }
                    );
                } else {
                    const msg = `Thanh toán chưa hoàn tất (status: ${paymentIntent.status}). Vui lòng thử lại.`;
                    toast.warning(msg, {
                        position: "top-center",
                        autoClose: 3000,
                    });
                }
            }
        } catch (err) {
            const errMsg = `Lỗi hệ thống thanh toán: ${err.message}`;
            onError(errMsg);
            toast.error(errMsg, { position: "top-center" });
        }

        setIsLoading(false);
    };

    const handleCancelClick = async () => {
        setIsCanceling(true);
        try {
            await onCancel();
        } finally {
            setIsCanceling(false);
        }
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
            <div className="d-flex gap-2 mt-4">
                <Button
                    variant="danger"
                    size="lg"
                    className="w-50"
                    onClick={handleCancelClick}
                    disabled={isLoading || isCanceling}
                    type="button"
                >
                    {isCanceling ? (
                        <>
                            <Spinner
                                animation="border"
                                size="sm"
                                className="me-2"
                            />
                            Đang hủy...
                        </>
                    ) : (
                        "Hủy"
                    )}
                </Button>
                <Button
                    variant="primary"
                    size="lg"
                    className="w-50"
                    disabled={isLoading || !stripe || !elements || isCanceling}
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
                        "Xác nhận"
                    )}
                </Button>
            </div>
        </form>
    );
};

CheckoutForm.propTypes = {
    onSuccess: PropTypes.func.isRequired,
    onError: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

const ProductDetailPanel = ({ product, isOpen, onClose }) => {
    const [clientSecret, setClientSecret] = useState(null);
    const [paymentIntentId, setPaymentIntentId] = useState(null);
    const [_error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [offerAmount, setOfferAmount] = useState("");
    const [offerWarning, setOfferWarning] = useState("");
    const [isOfferValid, setIsOfferValid] = useState(false);
    const [finalOfferAmount, setFinalOfferAmount] = useState(null);
    const debounceTimerRef = useRef(null);

    // Reset khi đóng panel
    useEffect(() => {
        if (!isOpen) {
            setClientSecret(null);
            setPaymentIntentId(null);
            setError(null);
            setSuccess(false);
            setIsInitializing(false);
            setOfferAmount("");
            setOfferWarning("");
            setIsOfferValid(false);
            setFinalOfferAmount(null);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
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

    // Hàm kiểm tra giá offer - moved before early return
    const priceAmount = product?.price?.amount ?? 0;
    const validateOffer = useCallback(
        (value) => {
            if (!value) {
                setOfferWarning("");
                setIsOfferValid(false);
                return;
            }

            const offerNum = parseFloat(value);
            if (Number.isNaN(offerNum)) {
                setOfferWarning("Vui lòng nhập số hợp lệ");
                setIsOfferValid(false);
                return;
            }

            if (offerNum <= priceAmount) {
                const warningMessage = `Giá offer phải lớn hơn giá gốc (${priceAmount})`;
                setOfferWarning(warningMessage);
                setIsOfferValid(false);
            } else {
                setOfferWarning("");
                setIsOfferValid(true);
            }
        },
        [priceAmount]
    );

    // Early return AFTER all hooks
    if (!product) return null;

    const taxRate = 0.08;

    // Tính toán giá cuối cùng - sử dụng finalOfferAmount nếu đã xác nhận
    let effectiveOfferAmount = priceAmount;
    if (finalOfferAmount !== null) {
        effectiveOfferAmount = finalOfferAmount;
    } else if (offerAmount) {
        const parsedOffer = parseFloat(offerAmount);
        effectiveOfferAmount = Number.isNaN(parsedOffer) ? 0 : parsedOffer;
    }

    const tax = roundToTwoDecimals(effectiveOfferAmount * taxRate);
    const total = roundToTwoDecimals(effectiveOfferAmount + tax);

    // Hàm debounce cho việc validate
    const handleOfferChange = (e) => {
        const { value } = e.target;

        // Chỉ cho phép số và dấu phẩy (thập phân)
        if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
            setOfferAmount(value);

            // Clear timer cũ nếu có
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Set timer mới với 600ms
            debounceTimerRef.current = setTimeout(() => {
                validateOffer(value);
            }, 600);
        }
    };

    const initializePayment = async () => {
        // Kiểm tra giá offer hợp lệ trước khi gọi API
        if (offerAmount) {
            if (!isOfferValid) {
                toast.error("Vui lòng nhập giá offer hợp lệ", {
                    position: "top-center",
                });
                return;
            }
            // Lưu giá offer cuối cùng đã xác nhận
            setFinalOfferAmount(parseFloat(offerAmount));
        }

        if (clientSecret || isInitializing) return;

        setIsInitializing(true);
        setError(null);

        try {
            // Gửi số tiền đã được làm tròn 2 số thập phân
            const amountToSend = total;

            const response = await fetch(
                "https://ghoul-helpful-salmon.ngrok-free.app/api/auth/create-payment-intent",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: product.id,
                        title: product.title,
                        amount: amountToSend,
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
            setPaymentIntentId(data.data.paymentIntentId);
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

        toast.success("Thanh toán thành công!", {
            position: "top-center",
            autoClose: 3000,
            onClose: () => {
                onClose();
            },
        });
    };

    const handleError = (msg) => {
        setError(msg);
    };

    const handleCancelPayment = async () => {
        if (paymentIntentId) {
            try {
                // Gọi API để hủy payment intent
                const response = await fetch(
                    "https://ghoul-helpful-salmon.ngrok-free.app/api/auth/cancel-payment-intent",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            paymentIntentId,
                        }),
                    }
                );

                const data = await response.json();

                if (data.success) {
                    toast.success("Đã hủy thanh toán", {
                        position: "top-center",
                        autoClose: 3000,
                    });
                } else {
                    toast.warning(data.message || "Không thể hủy thanh toán", {
                        position: "top-center",
                        autoClose: 3000,
                    });
                }
            } catch (err) {
                const errorMessage = `Lỗi khi hủy thanh toán: ${err.message}`;
                toast.error(errorMessage, {
                    position: "top-center",
                    autoClose: 3000,
                });
            }
        }

        // Reset state về ban đầu
        setClientSecret(null);
        setPaymentIntentId(null);
        setError(null);
        setFinalOfferAmount(null);
    };

    const isMobile = typeof window !== "undefined" && window.innerWidth < 992;

    // Kiểm tra xem đã khởi tạo thanh toán chưa
    const hasPaymentInitialized = clientSecret !== null;

    // Xác định giá trị hiển thị cho input
    let displayValue;
    if (hasPaymentInitialized) {
        displayValue =
            finalOfferAmount !== null
                ? finalOfferAmount.toFixed(2)
                : priceAmount.toFixed(2);
    } else {
        displayValue = offerAmount;
    }

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

            <div className="mb-3">
                <strong>Giá gốc:</strong>{" "}
                <span className="text-primary fw-bold">
                    {product.price?.currency || "$"}
                    {priceAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}{" "}
                    / lần
                </span>
            </div>

            <div className="mb-3">
                <strong>Đề xuất giá của bạn (offer):</strong>
                <Form.Control
                    type="text"
                    value={displayValue}
                    onChange={handleOfferChange}
                    placeholder={`Nhập giá lớn hơn ${priceAmount}`}
                    className="mt-1"
                    style={{
                        borderRadius: "8px",
                        border: "1px solid #ced4da",
                        padding: "10px",
                    }}
                    disabled={hasPaymentInitialized}
                    readOnly={hasPaymentInitialized}
                />
                {offerWarning && !hasPaymentInitialized && (
                    <Form.Text className="text-danger fst-italic mt-1 d-block">
                        {offerWarning}
                    </Form.Text>
                )}
                {hasPaymentInitialized && finalOfferAmount !== null && (
                    <Form.Text className="text-success mt-1 d-block">
                        Đã xác nhận offer: {product.price?.currency || "$"}
                        {finalOfferAmount.toFixed(2)}
                    </Form.Text>
                )}
            </div>

            {priceAmount > 0 || offerAmount ? (
                <>
                    <div className="mb-3">
                        <strong>Thuế (8%):</strong>{" "}
                        {product.price?.currency || "$"}
                        {tax.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                        })}
                    </div>
                    <hr />
                    <div className="mb-4">
                        <strong>Tổng thanh toán:</strong>{" "}
                        <span className="fs-4 fw-bold text-success">
                            {product.price?.currency || "$"}
                            {total.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                            })}
                        </span>
                    </div>
                </>
            ) : (
                <Alert variant="warning" className="mb-4">
                    Giá sản phẩm không hợp lệ hoặc chưa được thiết lập.
                </Alert>
            )}

            {!success && (
                <div className="mt-4">
                    {clientSecret ? (
                        <Elements
                            stripe={getStripe()}
                            options={{ clientSecret }}
                        >
                            <CheckoutForm
                                onSuccess={handleSuccess}
                                onError={handleError}
                                onCancel={handleCancelPayment}
                            />
                        </Elements>
                    ) : (
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-100"
                            onClick={initializePayment}
                            disabled={
                                isInitializing ||
                                (priceAmount <= 0 && !offerAmount) ||
                                (offerAmount && !isOfferValid)
                            }
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
