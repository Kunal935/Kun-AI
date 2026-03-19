import logging
import sys

def get_logger(name: str = __name__, level: int = logging.INFO) -> logging.Logger:
    """
    Returns a pre-configured logger.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    if not logger.handlers:
        # Console handler
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(level)

        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        ch.setFormatter(formatter)

        logger.addHandler(ch)
        logger.propagate = False

    return logger
