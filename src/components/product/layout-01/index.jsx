import PropTypes from "prop-types";
import Image from "next/image";
import clsx from "clsx";
import { ImageType } from "@utils/types";

const Product = ({ overlay, title, price, image }) => (
    <div className={clsx("product-style-one", !overlay && "no-overlay")}>
        <div className="card-thumbnail">
            {image?.src && (
                <Image
                    src={image.src}
                    alt={image?.alt || "NFT_portfolio"}
                    width={533}
                    height={533}
                />
            )}
        </div>
        <div className="product-share-wrapper">
            <div className="profile-share">
                <span className="product-name">{title}</span>
            </div>
        </div>
        <div className="product-share-wrapper">
            <div className="last-bid">
                {price.currency}
                {price.amount}
            </div>
        </div>
    </div>
);

Product.propTypes = {
    overlay: PropTypes.bool,
    title: PropTypes.string.isRequired,
    price: PropTypes.shape({
        amount: PropTypes.number.isRequired,
        currency: PropTypes.string.isRequired,
    }).isRequired,
    image: ImageType.isRequired,
};

Product.defaultProps = {
    overlay: false,
};

export default Product;
