import PropTypes from "prop-types";
import ScrollToTop from "@ui/scroll-to-top";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

const Wrapper = ({ children }) => (
    <>
        {children}
        <ScrollToTop />
        <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
            style={{ zIndex: 999999 }} // Tăng z-index để không bị che
            toastStyle={{ minWidth: "320px" }} // Đảm bảo toast đủ rộng, dễ thấy
            bodyClassName="text-center" // Căn giữa text trong toast
        />
    </>
);

Wrapper.propTypes = {
    children: PropTypes.node.isRequired,
};

export default Wrapper;