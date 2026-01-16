const IUPS = 

  "https://prod-15.uksouth.logic.azure.com:443/workflows/c24960915aeb4093bd96d7ddbd31b156/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F83kWtG9kyMu6jvkODZW2IM10GLFDUPpNx7QtdzpzIU"; 


const RAI = 

  "https://prod-11.uksouth.logic.azure.com:443/workflows/ee15d3958aa7454a89d0dba3110aeff1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=hpQbmiesBrm1au0XUBogFKZrQNoXVKQVHepYKwA5g2M"; 


const BLOB_ACCOUNT =  "https://cw2galleryblob.blob.core.windows.net/"; 

const DI = "https://prod-08.uksouth.logic.azure.com:443/workflows/b6dd013532de4b2bbee18323c41f3d7e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=SSjn6BkHnaN4armHwRexbieKcJhdT5L7UlEkjovnrMU"

const API_DELETE_POST_TEMPLATE =
  "https://prod-08.uksouth.logic.azure.com:443/workflows/b6dd013532de4b2bbee18323c41f3d7e/triggers/When_an_HTTP_request_is_received/paths/invoke/%7Bid%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=SSjn6BkHnaN4armHwRexbieKcJhdT5L7UlEkjovnrMU";


// === jQuery handlers ===
$(document).ready(function () {
  $("#retImages").click(getImages);
  $("#subNewForm").click(submitNewAsset);
  $("#logoutBtn").click(() => (window.location.href = "login.html"));
});

// === Upload new asset ===
function submitNewAsset() {
  const submitData = new FormData();
  submitData.append("FileName", $("#FileName").val());
  submitData.append("userID", $("#userID").val());
  submitData.append("userName", $("#userName").val());
  submitData.append("File", $("#UpFile")[0].files[0]);

  $.ajax({
    url: IUPS,
    data: submitData,
    cache: false,
    enctype: "multipart/form-data",
    contentType: false,
    processData: false,
    type: "POST",
    success: (data) => console.log("Upload response:", data),
    error: (xhr, status, err) => {
      console.error("Upload failed:", status, err, xhr?.responseText);
      alert("Upload failed — see console for details.");
    },
  });
}

// === Retrieve and render media list (grid + numbered video links) ===
function getImages() {
  const $list = $("#ImageList");
  $list
    .addClass("media-grid")
    .html('<div class="spinner-border" role="status"><span>Loading...</span></div>');

  $.ajax({
    url: RAI,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received:", data);
      if (!Array.isArray(data)) {
        $list.html("<p>No media found or invalid data format.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      $.each(data, function (_, val) {
        try {
          // Extract fields (case-insensitive) + unwrap base64 if needed
          let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
          let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
          let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
          let userID   = unwrapMaybeBase64(val.userID   || val.UserID   || "");
          const contentType = val.contentType || val.ContentType || "";

          const fullUrl = buildBlobUrl(filePath);
          const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

          // Build a card for the grid
          if (isVideo) {
            videoCounter += 1;
            const label = `video${videoCounter}`;

            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <!-- Simple poster area for video -->
                  <a class="video-link" href="${fullUrl}" target="_blank" download="${fileName || label}">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                </div>
                <button onclick="deletePost('${val.id || val.Id || ""}')">Delete</button>

              </div>
            `);
          } else {
            // Try as image; if it fails, we’ll swap to a link
            const safeLabel = escapeHtml(fileName || fullUrl);
            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <img src="${fullUrl}"
                       alt="${safeLabel}"
                       onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
                </div>
                <div class="media-body">
                  <span class="media-title">${safeLabel}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                  <div class="image-error"></div>
                </div>
                <button onclick="deletePost('${val.id || val.Id || ""}')">Delete</button>



              </div>
            `);
          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    },
  });
}

function deletePost(id) {
  if (!id) {
    alert("Missing post id");
    return;
  }

  if (!confirm("Delete this post (and its image)?")) return;

  // IMPORTANT: your Logic App expects NO relative path, so keep DI as-is
  // and send id as query string
  const url = DI + "&id=" + encodeURIComponent(id);

  $.ajax({
    url,
    type: "DELETE",
    success: (data) => {
      console.log("Delete response:", data);
      alert("Deleted!");
      getImages(); // refresh list
    },
    error: (xhr, status, err) => {
      console.error("Delete failed:", status, err, xhr?.responseText);
      alert("Delete failed - see console for details.");
    }
  });
}


// === Helpers ===
function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try { return atob(value.$content); } catch { return value.$content || ""; }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed; // already absolute
  const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

// Only detect videos; everything else is attempted as an image
function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

// Fallback: if an <img> fails to load, replace it with a link in-place
function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

// Minimal HTML-escaper for labels
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


















