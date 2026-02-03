import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import SectionTitle from "@components/section-title/layout-02";
import Product from "@components/product/layout-01";
import ProductFilter from "@components/product-filter/layout-01";
import FilterButton from "@ui/filter-button";
import { slideToggle } from "@utils/methods";
import { SectionTitleType, ProductType } from "@utils/types";
import ProductDetailPanel from "./ProductDetailPanel"; // component mới

function reducer(state, action) {
    switch (action.type) {
        case "FILTER_TOGGLE":
            return { ...state, filterToggle: !state.filterToggle };
        case "SET_INPUTS":
            return { ...state, inputs: { ...state.inputs, ...action.payload } };
        case "SET_PRODUCTS":
            return { ...state, products: action.payload };
        default:
            return state;
    }
}

const ExploreProductArea = ({ className, space, data }) => {
    const itemsToFilter = [...data.products]; // chỉ copy 1 lần

    const [state, dispatch] = useReducer(reducer, {
        filterToggle: false,
        products: data.products || [],
        inputs: { price: [0, 1200] },
    });

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const filterRef = useRef(null);

    const filterHandler = () => {
        dispatch({ type: "FILTER_TOGGLE" });
        if (filterRef.current) slideToggle(filterRef.current);
    };

    const slectHandler = ({ value }, name) => {
        dispatch({ type: "SET_INPUTS", payload: { [name]: value } });
    };

    const priceHandler = (value) => {
        dispatch({ type: "SET_INPUTS", payload: { price: value } });
    };

    const sortHandler = ({ value }) => {
        const sorted = [...state.products].sort((a, b) =>
            value === "most-liked"
                ? b.likeCount - a.likeCount
                : a.likeCount - b.likeCount
        );
        dispatch({ type: "SET_PRODUCTS", payload: sorted });
    };

    const filterMethods = (item, filterKey, value) => {
        if (value === "all") return false;
        let itemKey = filterKey === "category" ? "categories" : filterKey;

        if (filterKey === "price") {
            const amount = item.price?.amount;
            return amount < value[0] || amount > value[1];
        }

        if (Array.isArray(item[itemKey])) {
            return !item[itemKey].includes(value);
        }

        return item[itemKey] !== value;
    };

    // Filter chỉ chạy khi inputs thay đổi
    useEffect(() => {
        const filtered = itemsToFilter.filter((item) => {
            for (const key in state.inputs) {
                if (filterMethods(item, key, state.inputs[key])) {
                    return false;
                }
            }
            return true;
        });

        // Chỉ dispatch nếu filtered khác state.products (tránh loop)
        if (JSON.stringify(filtered) !== JSON.stringify(state.products)) {
            dispatch({ type: "SET_PRODUCTS", payload: filtered });
        }
    }, [state.inputs, itemsToFilter]); // dependency ổn định

    const handleProductClick = (e, prod) => {
        e.preventDefault(); // ngăn scroll jump
        e.stopPropagation();
        setSelectedProduct(prod);
        setIsPanelOpen(true);
    };

    const closePanel = () => {
        setIsPanelOpen(false);
        setSelectedProduct(null);
    };

    return (
        <div
            className={clsx(
                "rn-product-area",
                space === 1 && "rn-section-gapTop",
                className
            )}
        >
            <div className="container">
                {/* <div className="row mb--20 align-items-center">
                    <div className="col-lg-6 col-md-6 col-sm-6 col-12 mt_mobile--15">
                        <FilterButton open={state.filterToggle} onClick={filterHandler} />
                    </div>
                </div>

                <ProductFilter
                    ref={filterRef}
                    slectHandler={slectHandler}
                    sortHandler={sortHandler}
                    priceHandler={priceHandler}
                    inputs={state.inputs}
                /> */}

                <div className="row g-5">
                    {state.products.length > 0 ? (
                        state.products.slice(0, 10).map((prod) => (
                            <div
                                key={prod.id}
                                className="col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3" // điều chỉnh số cột cho đẹp
                                onClick={(e) => handleProductClick(e, prod)}
                                style={{ cursor: "pointer" }}
                            >
                                <Product
                                    overlay
                                    title={prod.title}
                                    price={prod.price}
                                    likeCount={prod.likeCount}
                                    image={prod.images?.[0]}
                                />
                            </div>
                        ))
                    ) : (
                        <p>Không có gói dịch vụ nào để hiển thị.</p>
                    )}
                </div>
            </div>

            {selectedProduct && (
                <ProductDetailPanel
                    product={selectedProduct}
                    isOpen={isPanelOpen}
                    onClose={closePanel}
                />
            )}
        </div>
    );
};

ExploreProductArea.propTypes = {
    className: PropTypes.string,
    space: PropTypes.oneOf([1, 2]),
    data: PropTypes.shape({
        section_title: SectionTitleType,
        products: PropTypes.arrayOf(ProductType),
        placeBid: PropTypes.bool,
    }),
};

export default ExploreProductArea;
