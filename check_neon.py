import psycopg
import os
from dotenv import load_dotenv
load_dotenv()

try:
    conn = psycopg.connect(os.getenv('NEON_DATABASE_URL'))
    cur = conn.cursor()
    
    # Basic counts
    cur.execute('SELECT COUNT(*) FROM cards')
    print(f'Cards: {cur.fetchone()[0]}')
    
    cur.execute('SELECT COUNT(*) FROM printings')
    print(f'Printings: {cur.fetchone()[0]}')
    
    cur.execute('SELECT COUNT(*) FROM retailer_products')
    print(f'Retailer products: {cur.fetchone()[0]}')
    
    cur.execute('SELECT COUNT(*) FROM retailer_products WHERE in_stock = 1')
    print(f'In-stock products: {cur.fetchone()[0]}')
    
    cur.execute('SELECT COUNT(*) FROM retailer_products WHERE printing_unique_id IS NOT NULL')
    print(f'Products with printing link: {cur.fetchone()[0]}')
    
    # Sample card with prices
    cur.execute("""
        SELECT c.name, p.unique_id, rp.price_cad, rp.in_stock, rp.retailer_slug
        FROM cards c 
        JOIN printings p ON p.card_unique_id = c.unique_id
        JOIN retailer_products rp ON rp.printing_unique_id = p.unique_id
        WHERE rp.in_stock = 1
        LIMIT 5
    """)
    print('\nSample in-stock products:')
    for row in cur.fetchall():
        print(f'  {row}')
    
    # Check a specific card
    cur.execute("SELECT unique_id, name FROM cards WHERE name LIKE '%Drop in the Ocean%'")
    cards = cur.fetchall()
    print(f'\n"Drop in the Ocean" cards: {cards}')
    
    if cards:
        card_uid = cards[0][0]
        cur.execute('SELECT unique_id, card_id, foiling FROM printings WHERE card_unique_id = %s', (card_uid,))
        printings = cur.fetchall()
        print(f'Printings: {printings[:3]}')
        
        if printings:
            cur.execute('SELECT retailer_slug, price_cad, in_stock FROM retailer_products WHERE printing_unique_id = %s', (printings[0][0],))
            print(f'Products for first printing: {cur.fetchall()[:5]}')
    
    conn.close()
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
