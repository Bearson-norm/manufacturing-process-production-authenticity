import requests
import json
import uuid

BASE_URL = "https://cukai-be.adsisolution.com/api/v1"

def test_create_manufacturing(mfg_id, sku):
    url = f"{BASE_URL}/manufacturing"
    payload = {
        "manufacturing_id": mfg_id,
        "sku": sku,
        "sku_name": f"Product {sku}",
        "target_qty": 100,
        "done_qty": 0,
        "leader_name": "Test Leader",
        "finished_at": None
    }
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    print(f"POST {url}: {response.status_code}")
    if response.status_code == 201:
        print(response.json())
        return response.json()['id']
    else:
        print(response.text)
        return None

def test_get_manufacturing(id):
    url = f"{BASE_URL}/manufacturing/{id}"
    response = requests.get(url)
    print(f"GET {url}: {response.status_code}")
    if response.status_code == 200:
        print(response.json())

def test_update_manufacturing(id):
    url = f"{BASE_URL}/manufacturing/{id}"
    payload = {
        "manufacturing_id": "MFG-UPDATED",
        "sku": "SKU-UPDATED",
        "sku_name": "Product UPDATED",
        "target_qty": 200,
        "done_qty": 50,
        "leader_name": "Test Leader Updated",
        "finished_at": None
    }
    headers = {'Content-Type': 'application/json'}
    response = requests.put(url, headers=headers, data=json.dumps(payload))
    print(f"PUT {url}: {response.status_code}")
    if response.status_code == 200:
        print(response.json())

def test_delete_manufacturing(id):
    url = f"{BASE_URL}/manufacturing/{id}"
    response = requests.delete(url)
    print(f"DELETE {url}: {response.status_code}")
    if response.status_code == 200:
        print(response.json())

def test_list_manufacturing():
    url = f"{BASE_URL}/manufacturing"
    response = requests.get(url)
    print(f"GET {url}: {response.status_code}")
    if response.status_code == 200:
        print(response.json())

if __name__ == "__main__":
    print("Testing Manufacturing API...")
    
    # Create
    new_id = test_create_manufacturing("MFG-001", "SKU-001")
    
    if new_id:
        # Get
        test_get_manufacturing(new_id)
        
        # Update
        test_update_manufacturing(new_id)
        
        # List
        test_list_manufacturing()
        
        # Delete
        test_delete_manufacturing(new_id)
        
        # Get after delete (should fail)
        test_get_manufacturing(new_id)
