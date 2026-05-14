**Version: 1.0.1**

# BackpackPlus Resource Pack Guide
### Resource Packs

#### Supported Versions
- **1.19.x - 1.21.3:** [Download Resource Pack](https://www.dropbox.com/scl/fi/l689igjynkcou8r2h9kww/BackpackPlus_resourcepack_1_19x1_21_3.zip?rlkey=d4kt3dbmtazcu0e7ezqd9fkbl&st=0xskwifd&dl=1)
- **1.21.4:** [Download Resource Pack](https://www.dropbox.com/scl/fi/b0orwjwm7q342fkidewjq/BackpackPlus_resourcepack_1_21_4.zip?rlkey=ynawukzi4gjb2evsp1ghq4mvb&st=hqen5z68&dl=1)

> **Note:** Changing the resource pack here will not have any effect unless you use the [ResourcePackManager](https://www.spigotmc.org/resources/resource-pack-manager.118574/) plugin. This plugin retrieves and automatically applies the resource pack for players. Without it, any manual changes to the resource pack will not update backpacks. Ensure the resource pack is updated in `config.yml`.

---

## How to Change the Resource Pack

1. Locate the default resource pack in the `pack` folder.
    - Extract it until you see a folder containing `assets`, `pack.mcmeta`, and `pack.png`.
2. Edit these files as needed.
3. Compress the modified files into a `.zip` archive.
4. Upload the archive to a hosting service. Suggested service: [MCPacks](https://mc-packs.net/).
5. Update your `config.yml`:
    - Set `resource-pack-url` to the download URL.
    - Set `resource-pack-hash` to the SHA-1 hash provided by the hosting service.
6. Reload the server and rejoin to apply changes.

---

## Using ResourcePackManager

To manage the resource pack using ResourcePackManager:

1. Edit or replace the `BackpackPlus/pack/resourcepack.zip` file.
    - Ensure the new file is named `resourcepack.zip` (avoid double extensions like `.zip.zip`).

2. Use the command:
   ```
   /rspm reload
   ```

3. Troubleshooting:
    - If problems persist, delete the `BackpackPlus_resource_pack.zip` file from the `ResourcePackManager/mixer` folder.
    - Run the command again:
      ```
      /rspm reload
      ```
---

## Using ItemsAdder

To ensure all backpacks work properly with ItemsAdder:

1. Create the following folder structure in your server:
    - `ItemsAdder/contents/backpackplus/resourcepack`
2. Copy the `assets` folder from the BackpackPlus resource pack into the `resourcepack` folder.
3. Run the command `/iazip` to generate the resource pack on the server.

---

## Resource Pack for Bedrock Edition

For compatibility with Bedrock Edition (Geyser):

1. **Download Files:**
    - [BackpackPlus Bedrock Resource Pack (`.mcpack`)](https://www.dropbox.com/scl/fo/0ndsqtxuuh81dztlmmf0q/AH-umlGt2pp0asmKN7lJ_ao?rlkey=yufp61f6zkkso0h0xvscwrply&st=155ykjgp&dl=0)
    - `geyser_mappings.json`

2. **Setup:**
    - Upload `backpackplus_geyser_resources.mcpack` to the `packs` folder in your Geyser directory.
    - Upload `geyser_mappings.json` to the `custom_mappings` folder in your Geyser directory.

3. **Apply Changes:**
    - Restart the server.

> **Notes:**
> - Some items may not look the same as they do in the Java Edition.
> - For detailed instructions on converting resource packs for Bedrock, visit this [forum thread](https://forum.devs.beer/d/33-discussion-how-to-add-bedrock-compatibility).

---
