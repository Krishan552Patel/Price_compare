# bridge package — connects CNN output to the Price_compare database
from .db_connector import DBConnector
from .card_mapper import map_cnn_to_enriched

__all__ = ["DBConnector", "map_cnn_to_enriched"]
