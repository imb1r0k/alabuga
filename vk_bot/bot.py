if event.type == VkEventType.MESSAGE_NEW and event.to_me:
                    vk_id = event.user_id
                    text = event.text.strip()
                    try:
                        payload_data = event.raw.get('payload', '{}')
                        if payload_data:
                            import json
                            payload = json.loads(payload_data)
                        else:
                            payload = None
                    except:
                        payload = None